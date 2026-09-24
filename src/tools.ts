import type { Context } from '@deepseek-ai/cordis';
import { defineTool, type ParameterSchemaSpec, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type {} from './service.js';
import '@deepseek-ai/dsh-user-questions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { normalizePackage, packageInput, packageRecord, fieldLabels, type PackageRecord } from './packages.js';
import { toCents, planInput, planRecord, planMetadata, evaluateMetaSchema } from './plans.js';

export const name='snow-trip-tools';
export const inject=['snowTrip','tools','userQuestions'];
const fields=Object.keys(packageInput.shape) as (keyof typeof packageInput.shape)[];
const draftParameter: ParameterSchemaSpec={draftId:{type:'string',required:true,description:'snow_draft 返回的草稿 ID'}};
const draftInput=z.strictObject({draftId:z.uuid()});
const queryInput=z.strictObject({id:z.uuid().optional(),query:z.string().trim().max(200).optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(20)});
const moneyFields=['quote','paid','paidExtra'];
const examples: Record<string,unknown>={quote:1299.5,paid:1299,paidExtra:0,nights:3,usedNights:0,voided:false,expectedRevision:1,offset:0,limit:20,validFrom:'2026-12-01',validTo:'2027-03-31',value:'长白山酒店'};
function example(key:string,name='') {return key==='value'&&name==='snow_unavailable_date'?'2026-12-25':examples[key]??(key==='draftId'?'使用返回的草稿 ID':'请按工具声明提供该字段');}
function amountsInYuan(data:Record<string,unknown>) {return Object.fromEntries(Object.entries(data).map(([key,value])=>[key,moneyFields.includes(key)&&typeof value==='number'?value/100:value]));}
function parse<T>(schema:z.ZodType<T>,args:unknown,name=''):T {
  const result=schema.safeParse(args);
  if(result.success)return result.data;
  throw new Error(result.error.issues.map(issue=>{
    const key=String(issue.path[0]??'参数');
    const received=typeof args==='object'&&args!==null?(args as Record<string,unknown>)[key]:args;
    return `${key}：收到 ${JSON.stringify(received)??'未提供'}；${issue.message}。示例：${JSON.stringify(example(key,name))}`;
  }).join('\n'));
}
function cents(value:number):number {
  if(!Number.isFinite(value)||value<0||!/^\d+(\.\d{1,2})?$/.test(String(value)))throw new Error(`金额：收到 ${value}；应为非负数字，最多两位小数。例如 1299.50（元）`);
  const [whole,fraction='']=String(value).split('.');
  const amount=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(amount>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('金额超出可保存范围');
  return Number(amount);
}
type Draft={owner:string;previous:PackageRecord|null;data:Record<string,unknown>;busy:boolean;saved?:PackageRecord};
export function apply(ctx: Context) {
  // ponytail: 草稿仅保存在本进程；服务重启后从会话资料重建，不把未确认内容混入已存套餐。
  const drafts=new Map<string,Draft>();
  ctx.effect(()=>()=>drafts.clear());
  const owner=(exec:ToolRunContext)=>{exec.signal.throwIfAborted();if(!exec.agent)throw new Error('需要当前会话');return exec.agent.id;};
  const get=(id:string,exec:ToolRunContext,edit=false)=>{
    const draft=drafts.get(id);
    if(!draft||draft.owner!==owner(exec))throw new Error('当前会话无此草稿，服务重启后请重新创建');
    if(edit&&(draft.busy||draft.saved))throw new Error(draft.saved?'草稿已保存，请重新打开套餐草稿':'正在保存，请等待结果');
    return draft;
  };
  const view=(id:string,draft:Draft)=>({draftId:id,status:draft.saved?'saved':'draft',id:draft.saved?.id??draft.previous?.id??null,expectedRevision:draft.saved?.revision??draft.previous?.revision??null,amountUnit:'元',package:amountsInYuan(draft.data)});
  const register=(name:string,description:string,parameters:ParameterSchemaSpec,execute:(args:Record<string,unknown>,exec:ToolRunContext)=>Promise<any>,commit=false,meta?:(args:any,value:any)=>unknown)=>{
    const presentation=commit?{presentationMeta:(args:any,value:any)=>{const draft=drafts.get(args.draftId)!;return {version:2,status:value.status==='adjusting'?'adjusting':'saved',previous:draft.previous,preview:normalizePackage(draft.data),record:value.status==='adjusting'?null:value};}}:meta?{presentationMeta:(args:any,value:any)=>meta(args,value) as never}:{};
    return ctx.tools.register(defineTool({
    name,description,parameters,
    output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(commit?{...amountsInYuan(value as Record<string,unknown>),amountUnit:'元'}:value)}],...presentation},
    execute,
    finalizeContent:(exec,result)=>{
      if(!result.isError)return;
      // 宿主可能在 execute 前拒绝类型；仍给模型具体类型及可直接照写的标量示例。
      const args=exec.arguments as Record<string,unknown>;
      const wrong=Object.entries(parameters).filter(([key,spec])=>args&&key in args&&'type' in spec&&((spec.type==='integer'&&!Number.isInteger(args[key]))||(['string','number','boolean'].includes(spec.type)&&typeof args[key]!==spec.type)));
      if(wrong.length)return [{type:'text',text:wrong.map(([key,spec])=>`${key}：收到 ${JSON.stringify(args[key])}；需要 ${'type' in spec?spec.type:''}。示例：${JSON.stringify(example(key,name))}`).join('\n')}];
    },
  }));};
  register('snow_query','查询已存套餐，金额单位为元；草稿不在此列表。返回分页信息。',{id:{type:'string'},query:{type:'string'},offset:{type:'integer'},limit:{type:'integer'}},async args=>{
    const {id,query,offset,limit}=parse(queryInput,args);
    const all=(await ctx.snowTrip.listPackages()).filter(p=>(!id||p.id===id)&&(!query||[p.name,p.description,...(p.hotels??[])].join(' ').includes(query)));
    return {packages:all.slice(offset,offset+limit).map(p=>({...p,quote:p.quote===null?null:p.quote/100,paid:p.paid===null?null:p.paid/100,paidExtra:p.paidExtra===null?null:p.paidExtra/100})),amountUnit:'元',total:all.length,truncated:offset+limit<all.length,nextOffset:offset+limit<all.length?offset+limit:null};
  });
  register('snow_draft','创建套餐草稿；修改已有套餐传 id 和最新 expectedRevision。重复调用返回同一未保存草稿。草稿未保存，重启后需重建。',{id:{type:'string'},expectedRevision:{type:'integer'}},async(args,exec)=>{
    const input=parse(z.strictObject({id:z.uuid().optional(),expectedRevision:z.number().int().min(1).optional()}).refine(v=>(v.id===undefined)===(v.expectedRevision===undefined),'更新需同时传 id 和 expectedRevision'),args);
    const session=owner(exec);
    const previous=input.id?await ctx.snowTrip.getPackage(input.id):null;
    if(input.id&&(!previous||previous.revision!==input.expectedRevision))throw new Error('套餐不存在或版本已变更，请重新查询');
    for(const [id,draft] of drafts)if(draft.owner===session&&!draft.saved&&draft.previous?.id===input.id){if(draft.previous?.revision!==previous?.revision)throw new Error('旧草稿版本已过期，请丢弃旧草稿后重新打开');return view(id,draft);}
    const id=randomUUID(),draft:Draft={owner:session,previous,data:previous?Object.fromEntries(fields.map(key=>[key,previous[key]])):{},busy:false};
    drafts.set(id,draft);return view(id,draft);
  });
  register('snow_draft_get','查看当前会话的草稿，金额为元。',draftParameter,async(args,exec)=>{const {draftId}=parse(draftInput,args);return view(draftId,get(draftId,exec));});
  register('snow_draft_discard','丢弃未保存草稿，不修改已存套餐。',draftParameter,async(args,exec)=>{const {draftId}=parse(draftInput,args);get(draftId,exec,true);drafts.delete(draftId);return {discarded:true};});
  for(const [name,keys,label] of [
    ['snow_set_basic',['name','description','roomType','resort','region','splitRule'],'基本信息'],
    ['snow_set_benefits',['skiIncluded','skiTickets','skiBasis','skiRule','breakfastIncluded','breakfastPeople','breakfastBasis','breakfastRule','spaIncluded','spaPeople','spaVisits','spaBasis','spaRule','splitAllowed'],'套餐权益；是否包含与数量、口径分别填写，数量不推算；口径 order=整单、night=每晚、day=每日、other=其他（具体写入说明）'],
    ['snow_set_purchase',['purchasePlatform','purchaseStatus','quote','paid','paidExtra'],'购买信息及金额（元，最多两位小数）'],
    ['snow_set_usage',['nights','usedNights','validFrom','validTo','voided'],'有效期（YYYY-MM-DD）和使用量'],
  ] as const){
    const parameters:ParameterSchemaSpec={...draftParameter};
    const shape:Record<string,z.ZodType>={draftId:z.uuid()};
    for(const key of keys){
      parameters[key]={type:moneyFields.includes(key)?'number':['nights','usedNights','skiTickets','breakfastPeople','spaPeople','spaVisits'].includes(key)?'integer':['voided','skiIncluded','breakfastIncluded','spaIncluded','splitAllowed'].includes(key)?'boolean':'string',description:fieldLabels[key]+(moneyFields.includes(key)?'；单位元，例如 1299.50':'；未知请省略，清空用 snow_clear_field')};
      if(['skiBasis','breakfastBasis','spaBasis'].includes(key))parameters[key]={type:'string',enum:['order','night','day','other'],description:'整单 / 每晚 / 每日 / 其他；未知省略，其他口径填写对应 Rule 说明'};
      if(key==='purchaseStatus')parameters[key]={type:'string',enum:['unknown','unpurchased','purchased']};
      shape[key]=moneyFields.includes(key)?z.number().transform((value,context)=>{try{return cents(value);}catch(error){context.addIssue({code:'custom',message:error instanceof Error?error.message:String(error)});return z.NEVER;}}).optional():packageInput.shape[key].unwrap().optional();
    }
    register(name,`修改草稿${label}，只传本次字段；不会保存或弹确认。`,parameters,async(args,exec)=>{
      const {draftId,...patch}=parse(z.strictObject(shape),args);
      if(!Object.keys(patch).length)throw new Error('至少提供一个要修改的字段');
      const draft=get(String(draftId),exec,true);draft.data={...draft.data,...patch};return view(String(draftId),draft);
    });
  }
  for(const [name,key,label] of [['snow_hotel','hotels','适用酒店'],['snow_surcharge','surchargeRules','补款规则'],['snow_unavailable_date','unavailableDates','不可用日期'],['snow_other_benefit','otherBenefits','其他权益'],['snow_pending_question','pendingQuestions','待澄清问题']] as const){
    register(name,`逐条增删草稿${label}。add/remove 时 value 为单个字符串；none 表示已确认没有，unknown 表示未知。`,{...draftParameter,action:{type:'string',enum:['add','remove','none','unknown'],required:true},value:{type:'string',description:key==='unavailableDates'?'单个日期，例如 2026-12-25':'单条文字，不要数组或对象'}},async(args,exec)=>{
      const {draftId,action,value}=parse(z.strictObject({draftId:z.uuid(),action:z.enum(['add','remove','none','unknown']),value:(key==='unavailableDates'?z.iso.date():z.string().trim().min(1).max(4000)).optional()}),args,name);
      if(['add','remove'].includes(action)&&value===undefined)throw new Error('value：请提供单条文字；例如 '+(key==='unavailableDates'?'2026-12-25':'长白山酒店'));
      const draft=get(draftId,exec,true),old=(draft.data[key]??[]) as string[];
      if(action==='remove'&&!old.includes(value!))throw new Error('该条目不在草稿中，请先查看草稿；移除操作未修改草稿');
      const next=action==='unknown'?(key==='pendingQuestions'?[]:null):action==='none'?[]:action==='add'?[...new Set([...old,value!])]:old.filter(item=>item!==value);
      packageInput.shape[key].parse(next);draft.data={...draft.data,[key]:next};return view(draftId,draft);
    });
  }
  register('snow_clear_field','将草稿中的一个字段重置为未知；不修改已存套餐。',{...draftParameter,field:{type:'string',enum:fields,required:true}},async(args,exec)=>{
    const {draftId,field}=parse(z.strictObject({draftId:z.uuid(),field:z.enum(fields)}),args),draft=get(draftId,exec,true);
    draft.data={...draft.data,[field]:field==='pendingQuestions'?[]:field==='purchaseStatus'?'unknown':null};return view(draftId,draft);
  });
  register('snow_commit','校验草稿后展示确认卡片，等待用户确认才保存。用户选择继续调整时返回 adjusting，不写入；停止提交并等待用户补充。重复提交已成功的草稿返回原结果，不重复新增。',draftParameter,async(args,exec)=>{
    const {draftId}=parse(draftInput,args),draft=get(draftId,exec);
    if(draft.saved)return draft.saved;
    if(draft.busy)throw new Error('正在保存，请等待结果');
    draft.busy=true;
    try{
      const normalized=parse(packageInput,draft.data),data=normalizePackage(normalized),previous=draft.previous;
      if(previous&&(await ctx.snowTrip.getPackage(previous.id))?.revision!==previous.revision)throw new Error('套餐版本已变更，请查询并重建草稿后重试');
      const answer=await ctx.userQuestions.ask({agent:exec.agent!,signal:exec.signal,questions:[{
        id:'snow-commit-'+exec.callId,header:previous?'确认修改套餐':'确认新增套餐',
        question:previous?'确认这些修改？':'确认保存这份套餐？',
        detail:JSON.stringify({callId:exec.callId,previous,preview:data}),
        options:[{label:'确认保存'},{label:'继续调整'}],
      }]});
      exec.signal.throwIfAborted();
      const selected=answer.answers[0];
      if(answer.answers.length!==1||selected?.id!=='snow-commit-'+exec.callId||selected.selected.length!==1||selected.selected[0]!=='确认保存'||selected.custom?.trim()){exec.concludeTurn();return {status:'adjusting',message:'未保存，继续调整。请等待用户补充，不要自行再次提交。'};}
      const now=new Date().toISOString();
      const record=packageRecord.parse({...data,id:previous?.id??randomUUID(),revision:previous?previous.revision+1:1,schemaVersion:1,createdAt:previous?.createdAt??now,updatedAt:now,sessionId:previous?.sessionId??owner(exec)});
      await ctx.snowTrip.savePackage(record,previous?.revision);draft.saved=record;return record;
    }finally{draft.busy=false;}
  },true);

  // —— 出行方案闭环（SNOW-06）：读取、受限脚本核算、保存。决策由会话 LLM 承担，
  // 通用代码只做数据完整性、版本校验与受限脚本执行，不做套餐组合或计费规则。
  const comboItem=z.strictObject({packageId:z.uuid(),revision:z.number().int().min(1),nights:z.number().int().min(1).max(366),start:z.iso.date()});
  const evaluateInput=z.strictObject({combos:z.array(comboItem).min(1).max(10)});
  const evaluateParameters:ParameterSchemaSpec={combos:{type:'array',items:{type:'json'},required:true,description:'候选搭配数组；每项 {"packageId":"套餐ID","revision":版本号,"start":"YYYY-MM-DD 入住日","nights":晚数}。一次最多 10 个候选。'}};
  register('snow_evaluate','按搭配执行本次核算脚本：读取参与套餐的完整原文与版本，对每个候选返回逐日住宿费用、计算依据与约束检查结果。只计算不保存；金额单位为元。日期为入住日，离店日不计费。',evaluateParameters,async(args,exec)=>{
    const {combos}=parse(evaluateInput,args);
    const session=owner(exec);
    // 版本与资料完整性在此统一校验；LLM 不能绕过 incomplete 套餐参与计算。
    const loaded=new Map<string,{record:PackageRecord}>();
    for(const combo of combos){
      if(loaded.has(combo.packageId))continue;
      const record=await ctx.snowTrip.getPackage(combo.packageId);
      if(!record)throw new Error(`套餐 ${combo.packageId} 不存在，请先 snow_query`);
      loaded.set(combo.packageId,{record});
    }
    const meta={version:1 as const,amountUnit:'元' as const,combos:combos.map(combo=>{
      const {record}=loaded.get(combo.packageId)!;
      if(record.revision!==combo.revision)throw new Error(`套餐「${record.name}」版本已变更（当前 ${record.revision}，请求 ${combo.revision}），请重新查询后计算`);
      if(record.completeness!=='complete')throw new Error(`套餐「${record.name}」资料未完成，不能参与计算`);
      return {packageId:combo.packageId,revision:combo.revision,nights:combo.nights,start:combo.start,snapshot:record};
    })};
    // 受限临时脚本数据：只有本次搭配的套餐原文（纯 JSON，金额单位分转元后提供），
    // 无函数、无网络、无写盘、无宿主对象；执行由宿主代码运行时承担。
    const toYuan=(value:number|null)=>value===null?null:value/100;
    const sandbox={
      combos:meta.combos.map(({snapshot,start,nights})=>({name:snapshot.name,hotel:snapshot.hotels,roomType:snapshot.roomType,nightsTotal:snapshot.nights,usedNights:snapshot.usedNights,purchaseStatus:snapshot.purchaseStatus,quote:toYuan(snapshot.quote),paid:toYuan(snapshot.paid),paidExtra:toYuan(snapshot.paidExtra),validFrom:snapshot.validFrom,validTo:snapshot.validTo,splitAllowed:snapshot.splitAllowed,splitRule:snapshot.splitRule,skiIncluded:snapshot.skiIncluded,skiTickets:snapshot.skiTickets,skiBasis:snapshot.skiBasis,skiRule:snapshot.skiRule,breakfastIncluded:snapshot.breakfastIncluded,breakfastPeople:snapshot.breakfastPeople,breakfastBasis:snapshot.breakfastBasis,breakfastRule:snapshot.breakfastRule,spaIncluded:snapshot.spaIncluded,spaPeople:snapshot.spaPeople,spaVisits:snapshot.spaVisits,spaBasis:snapshot.spaBasis,spaRule:snapshot.spaRule,otherBenefits:snapshot.otherBenefits,surchargeRules:snapshot.surchargeRules,unavailableDates:snapshot.unavailableDates,unknowns:snapshot.unknowns,start,nights,amountUnit:'元'})),
    };
    return {status:'ready',...meta,scriptSandbox:sandbox,sessionId:session,instructions:'以上 sandbox 提供套餐原文（金额单位：元）。请基于原始规则临时编写脚本并在下一轮用宿主代码执行能力实际运行，返回逐日费用、总价、计算依据与错误；不要心算金额。脚本只读，不得写套餐或保存方案。'};
  },false,(_args,value)=>evaluateMetaSchema.safeParse({version:1,amountUnit:'元',combos:value.combos}).success?{version:1,amountUnit:'元',combos:value.combos}:null);
  register('snow_save_plan','保存用户明确选中的出行方案。需要完整搭配、逐日费用与计算依据；保存前重新核查参与套餐版本与资料完成状态，套餐有变则拒绝保存。多选保存时逐份调用，不自动重试。',{
    plan:{type:'json',required:true,description:'方案对象：{"title":"方案名","start":"入住日|null","nights":总晚数|null,"budget":预算(元)|null,"total":整趟总价(元)|null,"paid":已付(元)|null,"pending":待付(元)|null,"reason":"推荐理由","allocation":"分摊依据","estimates":[{"label":"交通","amount":300,"basis":"用户接受"}],"items":[{"packageId":"ID","revision":版本,"nights":本次晚数,"start":"入住日"}],"daily":[{"date":"YYYY-MM-DD","packageId":"ID","amount":金额(元)|null,"basis":"依据"}],"sharedCosts":[{"label":"跨天共同费用","amount":0,"basis":"依据"}],"unknowns":["未知项"]}'},
  },async(args,exec)=>{
    const {plan}=parse(z.strictObject({plan:planInput}),args);
    const session=owner(exec);
    const cents=toCents(plan.budget),total=toCents(plan.total),paid=toCents(plan.paid),pending=toCents(plan.pending);
    const estimates=plan.estimates.map(e=>({label:e.label,amount:toCents(e.amount) as number,basis:e.basis}));
    const sharedCosts=plan.sharedCosts.map(e=>({label:e.label,amount:toCents(e.amount) as number,basis:e.basis}));
    const daily=plan.daily.map(row=>({...row,amount:row.amount===null?null:toCents(row.amount) as number}));
    const now=new Date().toISOString();
    // 保存前重新读取套餐：版本或资料状态变化时整份拒绝，不偷偷替换快照。
    const packages=[];
    for(const item of plan.items){
      const record=await ctx.snowTrip.getPackage(item.packageId);
      if(!record)throw new Error(`套餐 ${item.packageId} 不存在，方案未保存`);
      if(record.revision!==item.revision)throw new Error(`套餐「${record.name}」已变更（当前版本 ${record.revision}），方案未保存，请重新计算`);
      if(record.completeness!=='complete')throw new Error(`套餐「${record.name}」资料未完成，方案未保存，请先补全资料`);
      packages.push({id:record.id,revision:record.revision,snapshot:record});
    }
    const record=planRecord.parse({id:randomUUID(),schemaVersion:1,createdAt:now,sessionId:session,title:plan.title,start:plan.start,nights:plan.nights,budget:cents,total,paid,pending,reason:plan.reason,allocation:plan.allocation,estimates,items:plan.items,daily,sharedCosts,unknowns:plan.unknowns,packages});
    await ctx.snowTrip.savePlan(record);
    // 返回值给模型精简摘要；plan 快照仅进入持久化 metadata 供卡片回放。
    return {status:'saved',planId:record.id,amountUnit:'元',title:record.title,total:record.total===null?null:record.total/100,items:record.items.length,plan:record};
  },false,(_args,value)=>value?.status==='saved'?{version:1,status:'saved',plan:value.plan}:null);
}
