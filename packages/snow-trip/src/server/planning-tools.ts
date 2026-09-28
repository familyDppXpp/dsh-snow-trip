import type {Context} from '@deepseek-ai/cordis';
import {defineTool,type ParameterSchemaSpec,type ToolRunContext} from '@deepseek-ai/dsh-tools';
import {Worker} from 'node:worker_threads';
import {randomUUID} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {z} from 'zod';
import {conditions,segment,validate,validateSegments,calculate,PlanningError,dateAfter,type Planning,type Calculation} from '../shared/planning.js';
import {planQuestionSchema} from '../shared/plan-question.js';
import {toCents,planRecord,type PlanRecord} from '../shared/plans.js';
import type {PackageRecord} from '../shared/packages.js';
import {packageChanges,updatePreview} from './plan-update.js';
import type {} from './service.js';
import '@deepseek-ai/dsh-user-questions';
const str={type:'string' as const,required:true as const};
const int={type:'integer' as const,required:true as const};
const conditionParameters:ParameterSchemaSpec={start:{...str,description:'YYYY-MM-DD'},nights:{...int,description:'1–366 晚'},budget:{type:'integer',description:'不限预算必须省略此字段；设置上限时为正整数分，禁止用 0 表示不限'},rooms:{...int,description:'使用房间数，须已明确或待用户确认'},people:{type:'integer'},skiDays:{type:'integer'},packageIds:{type:'array',items:{type:'string'},description:'省略或空数组：全部完整套餐'},fees:{type:'array',items:{type:'object',additionalProperties:false,properties:{id:str,label:str,quantity:{type:'number',required:true},unitPrice:{...int,description:'单位价格，整数分'},basis:str,source:{type:'string',enum:['user','estimate'],required:true}}}}};
const itemParameters:ParameterSchemaSpec={packageId:str,revision:int,start:str,nights:int};
// 在独立线程中执行，超时/停止会终止整个线程，包括 await 后的脚本。
async function runScript(script:string,input:unknown,signal:AbortSignal):Promise<unknown>{
 signal.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const worker=new Worker(`const {parentPort,workerData}=require('node:worker_threads');const vm=require('node:vm');const context=vm.createContext({}, {codeGeneration:{strings:false,wasm:false},microtaskMode:'afterEvaluate'});try{vm.runInContext('globalThis.input=JSON.parse('+JSON.stringify(JSON.stringify(workerData))+')',context);vm.runInContext('globalThis.output=undefined;globalThis.failure=undefined; (async()=>{ const {conditions,items,packages}=input; '+workerData.script+'\\n})().then(v=>output=JSON.stringify(v),e=>failure=String(e));',context,{timeout:5000});if(context.failure)throw Error(context.failure);if(context.output===undefined)throw Error('脚本未返回可序列化结果；不支持外部异步 IO');parentPort.postMessage({value:JSON.parse(context.output)});}catch(e){parentPort.postMessage({error:String(e)});}`,{eval:true,workerData:{...(input as object),script},resourceLimits:{maxOldGenerationSizeMb:64}});
  const finish=(error:unknown,value?:unknown)=>{clearTimeout(timer);signal.removeEventListener('abort',abort);void worker.terminate();error?reject(error):resolve(value);};
  const abort=()=>finish(signal.reason??new Error('已停止'));
  const timer=setTimeout(()=>finish(new PlanningError('technical','script：执行超过 5 秒')),5000);
  signal.addEventListener('abort',abort,{once:true});
  worker.once('message',m=>finish(m.error?new PlanningError('technical',`script：${m.error}`):null,m.value));
  worker.once('error',e=>finish(new PlanningError('technical',`script：${e.message}`)));
  worker.once('exit',code=>{if(code!==0)finish(new PlanningError('technical',`script：执行线程退出 ${code}`));});
 });
}
export function registerPlanningTools(ctx:Context){
 const owner=(exec:ToolRunContext)=>{exec.signal.throwIfAborted();if(!exec.agent)throw new Error('需要当前会话');return exec.agent.id;};
 const add=(name:string,description:string,parameters:ParameterSchemaSpec,execute:(args:any,exec:ToolRunContext)=>Promise<any>)=>ctx.tools.register(defineTool({name,description,parameters,execute,output:{schema:{type:'json'},render:(_a,v)=>[{type:'text',text:JSON.stringify(v)}],presentationMeta:(_a,v:any)=>v as never}}));
 const planning=async(id:string,exec:ToolRunContext)=>{const p=await ctx.snowTrip.getPlanning(id);if(!p||p.sessionId!==owner(exec))throw new PlanningError('technical','planningId：当前会话不存在该规划');if(!p.confirmedByCard)throw new PlanningError('technical','此规划缺少卡片确认记录，请调用 snow_prepare_plan 由用户确认；不能直接核算或保存');if(p.supersededBy)throw new PlanningError('business',`条件已更新，请使用规划 ${p.supersededBy}`);return p;};
 const currentResult=async(id:string,exec:ToolRunContext)=>{const r=await ctx.snowTrip.getCalculation(id);if(!r||r.sessionId!==owner(exec))throw new PlanningError('technical','resultId：当前会话不存在该核算结果');await planning(r.planningId,exec);if(r.plan.costVersion!==2)throw new PlanningError('business','旧补款口径的核算结果不能再次保存，请重新核算；已存方案仍保留历史快照');for(const item of r.plan.packages){const p=await ctx.snowTrip.getPackage(item.id);if(!p||p.revision!==item.revision||p.completeness!=='complete')throw new PlanningError('business','套餐版本或资料状态变化，请重新核算');}return r;};
 const currentCalculations=async(id:string)=>(await ctx.snowTrip.listCalculations(id)).filter(result=>result.plan.costVersion===2);
 const resultView=(r:Calculation)=>({...r.plan,resultId:r.id,end:dateAfter(r.plan.start!,r.plan.nights!),allocation:r.plan.allocation?[r.plan.allocation]:[],checks:r.checks,switches:r.switches,estimated:r.estimated,daily:r.plan.daily.map(d=>({...d,hotel:r.plan.packages.find(p=>p.id===d.packageId)?.snapshot.hotels?.join('、')}))});
 const withConditions=async(plan:PlanRecord)=>{
  if(plan.conditions)return plan;
  const calculation=await ctx.snowTrip.getCalculation(plan.id);
  const original=calculation?await ctx.snowTrip.getPlanning(calculation.planningId):null;
  return original?{...plan,conditions:original.conditions}:plan;
 };
 const confirmUpdate=async(previous:PlanRecord,candidate:PlanRecord,exec:ToolRunContext,resultId?:string,rename=false)=>{
  owner(exec);
  const preview=rename?{plan:candidate,rows:[{label:'方案名称',before:previous.title,after:candidate.title,detail:false}],resetTracking:false,costChange:'仅修改标题，费用与套餐快照不变'}:updatePreview(await withConditions(previous),{...candidate,title:previous.title});
  const card=JSON.parse(JSON.stringify(validate(planQuestionSchema,{stage:'update',key:exec.callId,rename,copyTitle:candidate.title,previous,plan:preview.plan,changes:preview.rows,resetTracking:preview.resetTracking,costChange:preview.costChange})));
  const questionId=`snow-plan-update-${exec.callId}`;
  const answer=await ctx.userQuestions.ask({agent:exec.agent!,signal:exec.signal,questions:[{id:questionId,header:rename?'确认修改标题':'确认更新方案',question:rename?'核对原标题和新标题，确认后保存。':'核对修改前后差异，确认后保存。',detail:JSON.stringify(card)}]});
  exec.signal.throwIfAborted();
  const item=answer.answers[0];
  if(answer.answers.length!==1||item?.id!==questionId)throw new Error('更新卡回答与当前请求不匹配');
  const selected=item.selected??[],action=selected[0];
  const interaction={stage:'update',card,selected,custom:item.custom?.trim()||null};
  if(selected.length===1&&(action==='确认更新'||!rename&&action==='确认另存')){
   try{
    if(resultId)await currentResult(resultId,exec);
    const plan=rename?await ctx.snowTrip.renamePlan(previous,candidate.title,exec.signal):await ctx.snowTrip.replacePlan(previous,{...preview.plan,title:action==='确认另存'?candidate.title:previous.title},action==='确认另存',exec.signal);
    return {status:action==='确认另存'?'saved':'updated',plan,interaction:{...interaction,action:'update',status:'saved'},message:'保存已完成，按实际操作简短告知已更新或已另存，不重复要求确认。'};
   }catch(error){return {status:'failed',interaction:{...interaction,action:'update',status:'failed',error:String(error)},message:'保存失败，原方案未改变；说明原因，不自动重试。'};}
  }
  if(selected.length>1||selected.length===1&&!['继续调整','取消本次操作'].includes(action))throw new Error('更新卡操作无效');
  const cancelled=action==='取消本次操作'||!action&&!interaction.custom;
  if(cancelled||action==='继续调整'&&!interaction.custom)exec.concludeTurn();
  return {status:cancelled?'cancelled':'adjusting',planId:previous.id,interaction:{...interaction,action:cancelled?'cancel':action==='继续调整'?'adjust':'supplement'},custom:interaction.custom,message:cancelled?'已取消，原方案未改变。':'未保存；有补充则继续处理，没有补充则等待用户说明调整内容。'};
 };
 add('snow_rename_plan','仅修改已存方案标题。先查询定位方案，再传 planId 和 title（去除首尾空白后 1–200 字）；展示原标题与新标题确认卡，用户确认才保存。保留原 ID、费用、套餐快照及预约退改信息，不读取最新套餐、不重新核算、不需要 resultId 或 sourcePlanId。取消或失败不改名。',{planId:str,title:{...str,description:'用户指定的新标题，1–200 字'}},async(args,exec)=>{
  owner(exec);
  const {planId,title}=validate(z.strictObject({planId:z.uuid(),title:planRecord.shape.title}),args);
  const previous=await ctx.snowTrip.getPlan(planId);if(!previous)throw new Error('方案不存在或已删除');
  return confirmUpdate(previous,{...previous,title},exec,undefined,true);
 });
 add('snow_update_plan','更新已有方案：先按 planId 自动比较已存套餐快照与最新资料。仅名称/地区/雪场文字修正时直接展示差异确认卡，用户确认后更新原方案或另存；影响核算时返回 needs_calculation 和原条件，请以 sourcePlanId 调用 snow_prepare_plan 后重新核算。resultId 为可选；不传时直接比较套餐快照，无需先创建规划。传入时必须是绑定该原方案的新核算结果，不接收模型填写的差异或金额。', {planId:str,resultId:{type:'string'}},async(args,exec)=>{
  owner(exec);
  const {planId,resultId}=validate(z.strictObject({planId:z.uuid(),resultId:z.uuid().optional()}),args);
  const previous=await ctx.snowTrip.getPlan(planId);if(!previous)throw new Error('方案不存在或已删除');
  if(resultId){
   const r=await currentResult(resultId,exec),p=await planning(r.planningId,exec);
   if(!p.sourcePlan||p.sourcePlan.id!==planId)throw new Error('核算结果未绑定此原方案，请重新确认规划条件');
   if(!isDeepStrictEqual(p.sourcePlan,previous))throw new Error('原方案已变化，请重新核算并确认差异');
   return confirmUpdate(previous,r.plan,exec,r.id);
  }
  const latest:PackageRecord[]=[];for(const entry of previous.packages){const pkg=await ctx.snowTrip.getPackage(entry.id);if(!pkg)throw new Error('关联套餐已删除，请调整搭配后重新核算');latest.push(pkg);}
  const changes=packageChanges(previous,latest),old=await withConditions(previous);
  if(changes.requiresCalculation)return {status:'needs_calculation',sourcePlanId:planId,conditions:old.conditions??null,plan:old,packages:latest,changes:changes.rows,amountUnit:'分',message:'套餐费用、权益或规则已变化，使用 sourcePlanId 确认条件并重新核算；旧记录缺少的条件先澄清，不猜测。'};
  const candidate={...old,packages:latest.map(snapshot=>({id:snapshot.id,revision:snapshot.revision,snapshot})),items:old.items.map(i=>({...i,revision:latest.find(p=>p.id===i.packageId)!.revision}))};
  return confirmUpdate(previous,candidate,exec);
 });
 add('snow_list_plans','只读列出全部已存出行方案，不包含未保存的核算结果，不显示确认卡。金额为整数分。套餐快照属于方案保存时版本；需要最新套餐资料时用 snow_query 按套餐 ID 查询。',{},async args=>{
  validate(z.strictObject({}),args);
  return {plans:await ctx.snowTrip.listPlans(),amountUnit:'分'};
 });
 add('snow_query_plan','按方案 ID 只读查询已存方案，不显示确认卡。金额为整数分。套餐快照属于方案保存时版本；需要最新套餐资料时用 snow_query 按套餐 ID 查询。',{id:str},async args=>{
  const {id}=validate(z.strictObject({id:z.uuid()}),args);
  const plan=await ctx.snowTrip.getPlan(id);
  if(!plan)throw new Error('方案不存在或已删除');
  return {plan:await withConditions(plan),amountUnit:'分'};
 });
 add('snow_update_plan_tracking','用户明确要求时，按已存方案 ID 更新预约状态、是否可退和可退策略描述。省略字段保留原值；unknown 清空状态；改为不可退或未知会清空旧策略。可退必须有策略描述。只更新标签，不重新核算或改变行程费用，不展示编辑表单。先查询定位方案，不猜测 ID 或退改条件。',{
  id:str,booking:{type:'string',enum:['confirmed','unreserved','unknown'],description:'已确认、未预约或清空；省略则保留'},
  refund:{type:'string',enum:['refundable','nonrefundable','unknown'],description:'可退、不可退或清空；省略则保留'},
  refundPolicy:{type:'string',description:'用户提供的可退策略，例如 2月4日00:00前可退、未预约可退；省略保留'},
 },async(args,exec)=>{
  owner(exec);
  const {id,booking,refund,refundPolicy}=validate(z.strictObject({id:z.uuid(),booking:z.enum(['confirmed','unreserved','unknown']).optional(),refund:z.enum(['refundable','nonrefundable','unknown']).optional(),refundPolicy:z.string().trim().min(1).max(4000).optional()}),args);
  const patch={...(booking===undefined?{}:{booking:booking==='unknown'?null:booking}),...(refund===undefined?{}:{refund:refund==='unknown'?null:refund}),...(refundPolicy===undefined?{}:{refundPolicy})};
  const plan=await ctx.snowTrip.updatePlanTracking(id,patch);
  return {status:'updated',plan,amountUnit:'分'};
 });
 add('snow_prepare_plan','合并确认条件与共同费用并创建规划 ID。金额统一为整数分。首次创建及条件变更必须由用户点击卡片生成方案；模型不能跳过。更改条件时创建新规划，旧结果保留但不再用于新规划。',{sourcePlanId:{type:'string',description:'调整已存方案时必填，绑定原方案用于差异确认和原地更新'},conditions:{type:'object',properties:conditionParameters,additionalProperties:false,required:true},needsConfirmation:{type:'boolean',description:'兼容旧参数；无论 true/false 都必须由用户点击确认卡'},userEvidence:{type:'string',description:'用户提供的条件依据，不能代替卡片确认'}},async(args,exec)=>{
  const input=validate(z.strictObject({sourcePlanId:z.uuid().optional(),conditions,needsConfirmation:z.boolean().optional(),userEvidence:z.string().trim().min(1).optional()}),args);
  const sourcePlan=input.sourcePlanId?await ctx.snowTrip.getPlan(input.sourcePlanId):undefined;
  if(input.sourcePlanId&&!sourcePlan)throw new Error('原方案不存在或已删除');
  let value=input.conditions;
  const all=(await ctx.snowTrip.listPackages()).filter(p=>p.completeness==='complete'&&!p.voided);
  if(value.budget===0)throw new PlanningError('technical','conditions.budget：预算上限须大于 0；不限预算请省略 budget，不得传 0。修正参数后重试。');
  const current=await ctx.snowTrip.currentPlanning(owner(exec));
  const resolved={...value,packageIds:value.packageIds.length?value.packageIds:all.map(p=>p.id)};
  if(current?.confirmedByCard&&isDeepStrictEqual(current.sourcePlan,sourcePlan)&&isDeepStrictEqual({...current.conditions,packageIds:[...current.conditions.packageIds].sort()},{...resolved,packageIds:[...resolved.packageIds].sort()}))return {status:'prepared',confirmedByCard:true,reused:true,planningId:current.id,amountUnit:'分',conditions:current.conditions,message:'条件与费用已经确认，沿用此 planningId 核算；技术错误修正 items/script 后重试，不要重新确认。'};
  {
   const key=exec.callId;
   const answer=await ctx.userQuestions.ask({agent:exec.agent!,signal:exec.signal,questions:[{id:`snow-plan-confirm-${key}`,header:'确认这次出行',question:'核对出行条件与费用，确认后生成方案。',detail:JSON.stringify({stage:'confirm',key,planning:true,input:{...value,budget:value.budget===null?null:value.budget/100},ids:value.packageIds,packages:all,fees:value.fees,estimates:value.fees.map(f=>({label:f.label,amount:Math.round(f.quantity*f.unitPrice),basis:f.basis}))})}]});
   exec.signal.throwIfAborted();const item=answer.answers[0];
   if(answer.answers.length!==1||item?.id!==`snow-plan-confirm-${key}`)throw new PlanningError('technical','确认卡回答与当前请求不匹配');
   if(item.selected?.length!==1||item.selected[0]!=='生成方案'){
    const custom=item.selected?.includes('取消本次操作')?undefined:item.custom?.trim();
    if(custom)return {status:'adjusting',custom,conditions:value,packages:all.filter(pkg=>value.packageIds.includes(pkg.id)||!value.packageIds.length).map(pkg=>({id:pkg.id,name:pkg.name})),interaction:{stage:'confirm',action:'supplement',custom,conditions:value},message:'用户已提交补充说明，请根据补充继续处理并重新展示确认卡；当前条件与费用尚未确认，不得直接核算。'};
    exec.concludeTurn();return {status:'adjusting',custom:null,conditions:value,packages:all.filter(pkg=>value.packageIds.includes(pkg.id)||!value.packageIds.length).map(pkg=>({id:pkg.id,name:pkg.name})),interaction:{stage:'confirm',action:'cancel',conditions:value},message:'条件未确认，请等待用户补充'};
   }
   let edit;try{edit=JSON.parse(item.custom??'');}catch{throw new PlanningError('technical','确认卡未返回有效表单');}
   value=validate(conditions,{...value,...edit.values,budget:edit.values.budget==null||String(edit.values.budget).trim()===''?null:toCents(Number(edit.values.budget)),nights:Number(edit.values.nights),rooms:Number(edit.values.rooms),...(edit.values.people!==undefined?{people:Number(edit.values.people)}:{}),...(edit.values.skiDays!==undefined?{skiDays:Number(edit.values.skiDays)}:{}),packageIds:edit.ids,fees:edit.fees});
  }
  if(!value.packageIds.length)value={...value,packageIds:all.map(p=>p.id)};
  if(!value.packageIds.length||value.packageIds.some(id=>!all.some(p=>p.id===id)))throw new PlanningError('business','没有可用套餐，或指定套餐资料未完整');
  const p:Planning={id:randomUUID(),createdAt:new Date().toISOString(),sessionId:owner(exec),conditions:value,...(sourcePlan?{sourcePlan}:{}),confirmedByCard:true,supersededBy:null,status:'running'};
  await ctx.snowTrip.createPlanning(p);return {status:'prepared',confirmedByCard:true,planningId:p.id,amountUnit:'分',conditions:p.conditions,packages:all.filter(pkg=>value.packageIds.includes(pkg.id)).map(pkg=>({id:pkg.id,name:pkg.name,revision:pkg.revision}))};
 });
 add('snow_evaluate','核算一份完整候选。套餐 paid 是不含补款的套餐本价实付；snow_query 的 cumulativePaid 是整份套餐累计已支付，不可直接当本次方案成本，也不可再次叠加已付补款。只接收规划 ID、按日期排序的住宿段和脚本；已确认条件由工具读取。脚本接收 conditions/items/packages（金额均为分），返回 {daily:[{date,packageId,charges:[{purpose,amount,extraPaymentId?,rooms?}],basis}],coverage:[{feeId,quantity,basis}],total}；charges 为逐项补款（整数分），已有补款必须按用途和日期引用 extraPayments 的 id，每个适用明细每晚恰好一次，不能再作为新补款叠加；amount 是该夜该项已付+尚需之和，settled=true 以实际 paid 结清金额为准，未结清使用确认的 total。整包补款按本次间夜分摊；指定日期仅计对应晚；引用明细默认使用记录的 rooms，其他房间同项新费用另列无 ID 的项并明确 rooms，覆盖合计不得超出本次房间数。用途、金额或归属不明先补全套餐，改期不自动转用。coverage 为套餐覆盖的已确认费用数量，total 须含套餐分摊成本。工具验证全程覆盖、版本、有效期、禁用日期、剩余间夜、不可拆分、费用加总和预算。技术错误只修正 items/script 并沿用同一 planningId 重试，不限次数，不再调用 snow_prepare_plan；业务不合格淘汰，不擅改预算。',{planningId:str,title:str,reason:str,items:{type:'array',items:{type:'object',additionalProperties:false,properties:itemParameters},required:true},script:{...str,description:'JavaScript 函数体，最多 50000 字符；只使用 conditions/items/packages 和标准内建；禁止 IO'}},async(args,exec)=>{
  const a=validate(z.strictObject({planningId:z.uuid(),title:z.string().trim().min(1).max(200),reason:z.string().trim().min(1).max(4000),items:z.array(segment).min(1).max(20),script:z.string().trim().min(1).max(50000)}),args);
  const p=await planning(a.planningId,exec);
  await ctx.snowTrip.setPlanningStatus(p.id,'running');
  const packages=[];for(const id of new Set(a.items.map(i=>i.packageId))){const pkg=await ctx.snowTrip.getPackage(id);if(pkg)packages.push(pkg);}
  validateSegments(p,a.items,packages);
  try{
   const output=await runScript(a.script,{conditions:p.conditions,items:a.items,packages},exec.signal);exec.signal.throwIfAborted();
   const r=calculate(p,a.items,packages,output,a.title,a.reason);await ctx.snowTrip.putCalculation(r);
   return {status:'computed',planningId:p.id,resultId:r.id,amountUnit:'分',passed:(await currentCalculations(p.id)).length,message:'候选通过核算，完成比较后统一展示'};
  }catch(e){if(exec.signal.aborted)await ctx.snowTrip.setPlanningStatus(p.id,'stopped');throw e;}
 });
 add('snow_plan_results','读取已通过核算的结果；完成比较时传 complete=true。停止后仍可读取和保存已有结果，但不得声称完成全部比较。',{planningId:str,complete:{type:'boolean'}},async(args,exec)=>{
  const a=validate(z.strictObject({planningId:z.uuid(),complete:z.boolean().optional()}),args),p=await planning(a.planningId,exec);
  if(a.complete)await ctx.snowTrip.setPlanningStatus(p.id,'complete');
  const results=await currentCalculations(p.id);
  return {status:a.complete?'complete':p.status,planningId:p.id,comparisonComplete:a.complete||p.status==='complete',passed:results.length,results:results.sort((a,b)=>a.plan.total!-b.plan.total!||a.switches-b.switches).map(resultView)};
 });
 add('snow_plan_stage','展示核算结果、讨论或已存快照，并等待用户操作后才返回。返回 save_results 表示用户已提交保存，逐项按 items.status 报告成功或失败，不得再说等待选择或提示点击保存，不得重复保存。返回补充则处理 custom；取消则停止。结果/讨论只接收 resultIds；不得填写金额或行程。确认条件使用 snow_prepare_plan。',{stage:{type:'string',enum:['results','discussion','review','status'],required:true},key:str,planningId:{type:'string'},resultIds:{type:'array',items:{type:'string'}},planId:{type:'string'},message:{type:'string'}},async(args,exec)=>{
  const a=validate(z.strictObject({stage:z.enum(['results','discussion','review','status']),key:z.string().min(1).max(80),planningId:z.uuid().optional(),resultIds:z.array(z.uuid()).max(100).optional(),planId:z.uuid().optional(),message:z.string().max(4000).optional()}),args);
  let detail:any={stage:a.stage,key:a.key};let results:Calculation[]=[];
  if(a.stage==='results'||a.stage==='discussion'){
   if(!a.planningId)throw new PlanningError('technical','planningId：必填');const p=await planning(a.planningId,exec);
   const ids=a.resultIds??(await currentCalculations(p.id)).map(r=>r.id);
   for(const id of ids){const r=await currentResult(id,exec);if(r.planningId!==p.id)throw new PlanningError('technical','resultIds：不能混用不同规划');results.push(r);}
   results.sort((a,b)=>a.plan.total!-b.plan.total!||a.switches-b.switches);
   detail={...detail,results:results.map(resultView),selected:a.stage==='discussion'?results.map((_,i)=>i):[],message:a.message,comparisonComplete:p.status==='complete',updating:!!p.sourcePlan};
   if(!results.length)detail={stage:'status',key:a.key,notice:{title:'暂无通过核算的方案',text:'请查看核算失败原因，调整条件后重新生成。',actions:[{label:'调整条件',value:'adjust'}]}};
  }else if(a.stage==='review'){
   if(!a.planId)throw new PlanningError('technical','planId：必填');const plan=await ctx.snowTrip.getPlan(a.planId);if(!plan)throw new PlanningError('technical','planId：方案不存在');detail.plan={...plan,allocation:plan.allocation?[plan.allocation]:[]};
  }else detail.notice={title:'规划状态',text:a.message??'可调整条件后继续规划。',actions:[{label:'调整条件',value:'adjust'}]};
  const card=JSON.parse(JSON.stringify(validate(planQuestionSchema,detail)));
  const questionId=`snow-plan-${detail.stage}-${a.key}`;
  const answer=await ctx.userQuestions.ask({agent:exec.agent!,signal:exec.signal,questions:[{id:questionId,header:'雪季方案',question:'查看方案或继续调整。',detail:JSON.stringify(card)}]});
  exec.signal.throwIfAborted();const item=answer.answers[0];
  if(answer.answers.length===1&&item?.id===questionId&&item.selected?.includes('取消本次操作')){exec.concludeTurn();return {status:'cancelled',interaction:{stage:detail.stage,action:'cancel',card},message:'用户已取消，等待新的指示，不得自动核算或保存。'};}
  if(answer.answers.length===1&&item?.id===questionId&&item?.selected?.length===1&&item.selected[0]==='保存所选'){
   const payload=validate(z.strictObject({stage:z.literal('results'),selected:z.array(z.number().int().nonnegative()).min(1)}),JSON.parse(item.custom??'{}'));
   const p=results.length?await planning(results[0].planningId,exec):null;
   if(p?.sourcePlan){
    if(payload.selected.length!==1||!results[payload.selected[0]])throw new Error('更新原方案必须选择一份候选');
    const r=await currentResult(results[payload.selected[0]].id,exec);
    const updated=await confirmUpdate(p.sourcePlan,r.plan,exec,r.id);
    return {...updated,interaction:{...updated.interaction,selection:{card,selected:payload.selected}}};
   }
   const saved=[];for(const index of new Set(payload.selected)){try{if(!results[index])throw new Error('所选方案不存在');const r=await currentResult(results[index].id,exec);const plan=await ctx.snowTrip.savePlan(r.plan);saved.push({resultId:r.id,status:'saved',planId:r.id,title:plan.title,plan});}catch(e){saved.push({resultId:results[index]?.id,status:'failed',error:String(e)});}}
   return {status:'save_results',message:'用户已完成选择并提交保存。按 items 中每项 status 简短说明实际结果；saved 才表示保存成功，failed 需说明失败原因。前端已保留只读选择记录并展示保存结果，不要再提示点击保存，不重复展示完整对比，不重复调用保存。',items:saved,interaction:{stage:detail.stage,action:'save',card,selected:item.selected,custom:null,items:saved}};
  }
  return {status:'answered',selected:item?.selected??[],custom:item?.custom??null,interaction:{stage:detail.stage,action:item?.selected?.length?'action':item?.custom?.trim()?'supplement':'cancel',card,selected:item?.selected??[],custom:item?.custom??null}};
 });
 add('snow_save_plan','按核算结果 ID 保存用户明确选择的方案；等待用户在确认卡操作并完成保存后才返回。返回 saved 时简短告知已保存及可在已存方案查看，不再要求点击保存；取消或补充按实际操作回应。失败不自动重试，不接受模型填写金额或行程。',{resultId:str},async(args,exec)=>{
  const {resultId}=validate(z.strictObject({resultId:z.uuid()}),args),r=await currentResult(resultId,exec);
  const p=await planning(r.planningId,exec);
  if(p.sourcePlan)return confirmUpdate(p.sourcePlan,r.plan,exec,r.id);
  const key=exec.callId,questionId=`snow-plan-results-${key}`;
  const answer=await ctx.userQuestions.ask({agent:exec.agent!,signal:exec.signal,questions:[{id:questionId,header:'保存方案',question:'选择并保存这份方案。',detail:JSON.stringify({stage:'results',key,results:[resultView(r)],selected:[0]})}]});
  exec.signal.throwIfAborted();const item=answer.answers[0];
  if(answer.answers.length===1&&item?.id===questionId&&item.selected?.includes('取消本次操作')){exec.concludeTurn();return {status:'cancelled',interaction:{stage:'results',action:'cancel',card:JSON.parse(JSON.stringify({results:[resultView(r)]}))},message:'用户取消保存，等待新的指示。'};}
  if(answer.answers.length!==1||item?.id!==questionId||item.selected?.length!==1||item.selected[0]!=='保存所选')return {status:'cancelled',interaction:{stage:'results',action:item?.custom?.trim()?'supplement':'cancel',custom:item?.custom??null,card:{results:[resultView(r)]}}};
  const payload=validate(z.strictObject({stage:z.literal('results'),selected:z.tuple([z.literal(0)])}),JSON.parse(item.custom??'{}'));
  await currentResult(resultId,exec);const plan=await ctx.snowTrip.savePlan(r.plan);return {version:1,status:'saved',plan,interaction:{stage:'results',action:'save',card:{results:[resultView(r)]},items:[{title:plan.title,status:'saved',planId:r.id}]}};
 });
}
