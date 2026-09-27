import type { Context } from '@deepseek-ai/cordis';
import { defineTool, type ParameterSchemaSpec, type ToolRunContext } from '@deepseek-ai/dsh-tools';
import type {} from './service.js';
import '@deepseek-ai/dsh-user-questions';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { extraPayment, normalizePackage, packageInput, packageRecord, fieldLabels, type PackageRecord } from './packages.js';
import {registerPlanningTools} from './planning-tools.js';

export const name='snow-trip-tools';
export const inject=['snowTrip','tools','userQuestions'];
const fields=Object.keys(packageInput.shape) as (keyof typeof packageInput.shape)[];
const draftParameter: ParameterSchemaSpec={draftId:{type:'string',required:true,description:'snow_draft 返回的草稿 ID'}};
const draftInput=z.strictObject({draftId:z.uuid()});
const queryInput=z.strictObject({id:z.uuid().optional(),query:z.string().trim().max(200).optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(20)});
const moneyFields=['quote','paid','paidExtra'];
const examples: Record<string,unknown>={quote:1299.5,paid:1299,paidExtra:0,nights:3,usedNights:0,voided:false,expectedRevision:1,offset:0,limit:20,validFrom:'2026-12-01',validTo:'2027-03-31',value:'长白山酒店'};
function example(key:string,name='') {return key==='value'&&name==='snow_unavailable_date'?'2026-12-25':examples[key]??(key==='draftId'?'使用返回的草稿 ID':'请按工具声明提供该字段');}
function amountsInYuan(data:Record<string,unknown>) {return Object.fromEntries(Object.entries(data).map(([key,value])=>[key,key==='extraPayments'&&Array.isArray(value)?value.map(row=>({...row,paid:typeof row.paid==='number'?row.paid/100:row.paid,total:typeof row.total==='number'?row.total/100:row.total})):moneyFields.includes(key)&&typeof value==='number'?value/100:value]));}
function parse<T>(schema:z.ZodType<T>,args:unknown,name=''):T {
  const result=schema.safeParse(args);
  if(result.success)return result.data;
  throw new Error(result.error.issues.map(issue=>{
    const key=issue.path.map((p,i)=>typeof p==='number'?`[${p}]`:`${i?'.':''}${String(p)}`).join('')||'参数';
    const received=issue.path.reduce<unknown>((value,p)=>value&&typeof value==='object'?(value as Record<string,unknown>)[String(p)]:undefined,args);
    return `${key}：收到 ${JSON.stringify(received)??'未提供'}；${issue.message}。示例：${JSON.stringify(example(String(issue.path.at(-1)??key),name))}`;
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
    const presentation=commit?{presentationMeta:(args:any,value:any)=>{const draft=drafts.get(args.draftId)!;return {version:2,status:['adjusting','cancelled'].includes(value.status)?value.status:'saved',previous:draft.previous,preview:normalizePackage(draft.data),record:['adjusting','cancelled'].includes(value.status)?null:value,custom:value.status==='adjusting'?value.custom??null:null};}}:meta?{presentationMeta:(args:any,value:any)=>meta(args,value) as never}:{};
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
  register('snow_query','查询已存套餐，金额单位为元；草稿不在此列表。返回分页信息。',{id:{type:'string'},query:{type:'string'},offset:{type:'integer',description:'从 0 开始；后续页使用返回的 nextOffset'},limit:{type:'integer',description:'每页 1–50 条，默认 20；读取全部时按 truncated/nextOffset 逐页查询',default:20}},async args=>{
    const {id,query,offset,limit}=parse(queryInput,args);
    const all=(await ctx.snowTrip.listPackages()).filter(p=>(!id||p.id===id)&&(!query||[p.name,p.description,...(p.hotels??[])].join(' ').includes(query)));
    return {packages:all.slice(offset,offset+limit).map(p=>amountsInYuan(p)),amountUnit:'元',total:all.length,truncated:offset+limit<all.length,nextOffset:offset+limit<all.length?offset+limit:null};
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
  register('snow_extra_payment','逐条整理已付补款明细，金额为元。upsert 不传 id 新增，传返回的 id 修改；purpose 用途，scope=package 整个套餐或 date 指定一晚（date+rooms），paid 已付，total 未结清时确认的应付总额，settled 是否商家确认结清，basis 用户依据。缺项可暂存但不算完整资料。修改已有覆盖范围须用户明确允许转用并传 transferConfirmed=true。none 明确无补款；unknown 清空明细但保留已付总额。已知明细与原总额一致时同步总额；尚有未归属余额时保留原总额待核对。',{
    ...draftParameter,action:{type:'string',enum:['upsert','remove','none','unknown'],required:true},id:{type:'string'},purpose:{type:'string'},scope:{type:'string',enum:['package','date']},date:{type:'string'},rooms:{type:'integer'},paid:{type:'number'},total:{type:'number'},settled:{type:'boolean'},basis:{type:'string'},transferConfirmed:{type:'boolean'},
  },async(args,exec)=>{
    const a=parse(z.strictObject({draftId:z.uuid(),action:z.enum(['upsert','remove','none','unknown']),id:z.string().trim().min(1).max(80).optional(),purpose:z.string().trim().min(1).max(4000).optional(),scope:z.enum(['package','date']).optional(),date:z.iso.date().optional(),rooms:z.number().int().min(1).max(100).optional(),paid:z.number().transform(cents).optional(),total:z.number().transform(cents).optional(),settled:z.boolean().optional(),basis:z.string().trim().min(1).max(4000).optional(),transferConfirmed:z.boolean().optional()}),args);
    const draft=get(a.draftId,exec,true),rows=z.array(extraPayment).parse(draft.data.extraPayments??[]);
    const {draftId,action,id,transferConfirmed,...patch}=a;
    if((action==='none'||action==='unknown')&&id)throw new Error('清空全部明细不接受单条 ID；删除单条请用 remove');
    if(action!=='upsert'&&(Object.keys(patch).length||transferConfirmed!==undefined))throw new Error('仅 upsert 可修改明细字段');
    let next:typeof rows|null;
    if(action==='unknown')next=null;
    else if(action==='none')next=[];
    else if(action==='remove'){
      if(!id||!rows.some(row=>row.id===id))throw new Error('明细不存在，请先查询草稿');
      next=rows.filter(row=>row.id!==id);
    }else{
      if(!Object.keys(patch).length)throw new Error('请提供补款明细');
      const old=rows.find(row=>row.id===id);
      if(id&&!old)throw new Error('明细不存在，请使用返回的 ID');
      if(old&&(['scope','date','rooms'] as const).some(key=>key in patch&&old[key]!==null&&patch[key]!==old[key])&&!transferConfirmed)throw new Error('补款改期或覆盖范围变化，请先确认商家允许转用');
      const row=extraPayment.parse({...old,...patch,id:id??randomUUID(),...(patch.scope==='package'?{date:null,rooms:null}:{})});
      next=old?rows.map(item=>item.id===id?row:item):[...rows,row];
    }
    const data:Record<string,unknown>={...draft.data,extraPayments:next};
    if(next&&next.every(row=>row.paid!==null)&&(action==='none'||draft.data.paidExtra==null||(rows.every(row=>row.paid!==null)&&draft.data.paidExtra===rows.reduce((sum,row)=>sum+row.paid!,0))))data.paidExtra=z.number().int().nonnegative().safe().parse(next.reduce((sum,row)=>sum+row.paid!,0));
    draft.data=data;return view(draftId,draft);
  });
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
        options:[{label:'确认保存'},{label:'继续调整'},{label:'取消本次操作'}],
      }]});
      exec.signal.throwIfAborted();
      const selected=answer.answers[0];
      if(answer.answers.length===1&&selected?.id==='snow-commit-'+exec.callId&&selected.selected?.length===1&&selected.selected[0]==='取消本次操作'){exec.concludeTurn();return {status:'cancelled',message:'用户取消本次操作，未保存。等待用户新的指示，不得自动重新提交。'};}
      if(answer.answers.length!==1||selected?.id!=='snow-commit-'+exec.callId||selected.selected.length!==1||selected.selected[0]!=='确认保存'||selected.custom?.trim()){const custom=selected?.custom?.trim();if(!custom)exec.concludeTurn();return {status:'adjusting',custom:custom??null,message:custom?'用户已提交补充，请据此修改草稿后重新确认，尚未保存。':'未保存，继续调整。请等待用户补充，不要自行再次提交。'};}
      const now=new Date().toISOString();
      const record=packageRecord.parse({...data,id:previous?.id??randomUUID(),revision:previous?previous.revision+1:1,schemaVersion:1,createdAt:previous?.createdAt??now,updatedAt:now,sessionId:previous?.sessionId??owner(exec)});
      await ctx.snowTrip.savePackage(record,previous?.revision);draft.saved=record;return record;
    }finally{draft.busy=false;}
  },true);

  registerPlanningTools(ctx);
}
