// 方案卡片共用的服务端校验与客户端识别，兼容已在等待回答的传输负载。
import {z} from 'zod';

// 只按字段声明转换传输值，不对任意业务对象做递归猜测。
const list=item=>z.union([z.array(item),z.strictObject({item:z.union([z.array(item),item])}).transform(v=>Array.isArray(v.item)?v.item:[v.item])]);
const number=z.union([z.number(),z.string().regex(/^\d+(\.\d+)?$/).transform(Number)]).pipe(z.number().finite().nonnegative());
const integer=number.pipe(z.number().int().safe());
const boolean=z.union([z.boolean(),z.enum(['true','false']).transform(v=>v==='true')]);
const money=integer.nullable();
const packageSummary=z.looseObject({id:z.string(),name:z.string().optional(),purchaseStatus:z.string().optional(),nights:integer.nullable().optional(),splitAllowed:boolean.nullable().optional(),completeness:z.string().optional()});
const cost=z.looseObject({label:z.string(),amount:money.optional(),basis:z.string().nullable().optional()});
const daily=z.looseObject({date:z.string(),hotel:z.string().optional(),amount:money.optional(),basis:z.string().nullable().optional()});
const result=z.looseObject({
  title:z.string().optional(),start:z.string().nullable().optional(),end:z.string().nullable().optional(),nights:integer.nullable().optional(),
  total:money.optional(),paid:money.optional(),pending:money.optional(),budget:money.optional(),estimated:boolean.optional(),switches:integer.optional(),
  daily:list(daily).optional(),sharedCosts:list(cost).optional(),allocation:z.union([list(z.string()),z.string().transform(v=>[v])]).nullable().optional(),checks:list(z.string()).optional(),
  reason:z.string().nullable().optional(),unknowns:list(z.string()).optional(),packages:list(z.looseObject({})).optional(),
});
// 兼容已发出的估算请求：该旧形状把首项放在 suggested.item，后续项放在根 item。
// 仅接受完整的费用项，不推算、不修改任何金额；新调用仍应使用 estimates/basis/scope。
function legacyEstimate(value) {
  if(!value||typeof value!=='object'||value.stage!=='estimate'||value.estimates!==undefined||!value.suggested?.item)return value;
  const entries=[value.suggested.item,...(Array.isArray(value.item)?value.item:value.item?[value.item]:[])];
  const parsed=z.array(z.looseObject({label:z.string(),amount:money,note:z.string()})).safeParse(entries);
  if(!parsed.success)return value;
  const {suggested,item,$text,...rest}=value;
  return {...rest,estimates:parsed.data.map(({note,...entry})=>({...entry,basis:note})),scope:value.scope??$text};
}
export const planQuestionSchema=z.preprocess(legacyEstimate,z.looseObject({
  stage:z.enum(['confirm','estimate','results','discussion','review','update','status']),
  input:z.looseObject({start:z.string().optional(),nights:integer.nullable().optional(),budget:number.nullable().optional()}).optional(),
  ids:list(z.string()).optional(),
  suggestions:z.union([list(z.string()),z.strictObject({start:z.string().optional(),nights:integer.optional()})]).optional(),
  estimates:list(cost).optional(),start:z.string().nullable().optional(),nights:integer.nullable().optional(),scope:z.string().optional(),
  suggested:z.strictObject({start:boolean.optional(),nights:boolean.optional()}).optional(),
  results:list(result).optional(),selected:list(integer).optional(),message:z.string().optional(),parent:z.string().nullable().optional(),
  notice:z.looseObject({title:z.string(),text:z.string(),tone:z.string().optional(),actions:list(z.looseObject({label:z.string(),value:z.string()})).optional()}).optional(),
  packages:list(packageSummary).optional(),plan:result.optional(),
  changes:list(z.strictObject({label:z.string(),before:z.string(),after:z.string(),detail:boolean})).optional(),
  resetTracking:boolean.optional(),costChange:z.string().optional(),previous:result.optional(),

}).superRefine((value,ctx)=>{
  if(value.stage==='update'&&(!value.plan||!value.previous||!value.changes||value.resetTracking===undefined||!value.costChange))ctx.addIssue({code:'custom',message:'更新卡缺少差异或快照'});
  if(value.stage==='estimate'&&!value.estimates?.length)ctx.addIssue({code:'custom',path:['estimates'],message:'请提供 estimates 费用列表'});
  if(value.stage==='review'&&!value.plan)ctx.addIssue({code:'custom',path:['plan'],message:'请提供保存时快照'});
  if(value.selected?.some(index=>index>=(value.results?.length??0)))ctx.addIssue({code:'custom',path:['selected'],message:'所选方案不存在'});
}));

// 判定一个 pending 交互是否为方案问题卡；返回解析后的负载或 null。
export function planQuestion(pending) {
  const q=pending?.questions?.[0];
  if(pending?.questions?.length!==1||!q?.id?.startsWith('snow-plan-'))return null;
  if(!/^snow-plan-(confirm|estimate|results|discussion|review|update|status)-.+$/.test(q.id))return null;
  const invalid=fields=>({stage:'status',callId:q.id,invalid:true,questionText:q.question??'',pending:q,notice:{title:'方案卡片数据有误',text:`${fields}。原请求尚未确认，请让助理按阶段格式重新生成；不会自动接受费用或保存方案。`,actions:[{label:'请助理重新生成卡片',value:'regenerate'}]}});
  try{
    const raw=JSON.parse(q.detail??'{}');
    if(raw?.stage&&raw?.key&&q.id!==`snow-plan-${raw.stage}-${raw.key}`)return null;
    const parsed=planQuestionSchema.safeParse(raw);
    if(!parsed.success)return invalid('需检查字段：'+[...new Set(parsed.error.issues.map(issue=>issue.path.join('.')||'detail'))].join('、'));
    if(q.id!==`snow-plan-${raw.stage}-${raw.key}`)return invalid('缺少阶段或实例标识');
    return {...parsed.data,callId:q.id,questionText:q.question??'',pending:q};
  }catch{return invalid('无法读取卡片内容');}
}

// 构造 ask_user_question 请求项（服务端工具侧使用）。
export function planQuestionItem(stage,key,detail,options,header,multiSelect=false) {
  return {id:`snow-plan-${stage}-${key}`,question:detail.question??'',detail:JSON.stringify({...detail,stage,key}),...(header?{header}:{}) ,...(options?{options,multiSelect}:{})};
}
