import {z} from 'zod';
import {planRecord} from './plans.js';
import {extraPaymentUnknowns,type PackageRecord} from './packages.js';
const text=z.string().trim().min(1).max(4000);
export const amount=z.number().int().nonnegative().safe();
export const fee=z.strictObject({id:text,label:text,quantity:z.number().nonnegative().max(100000),unitPrice:amount,basis:text,source:z.enum(['user','estimate'])});
export const conditions=z.strictObject({start:z.iso.date(),nights:z.number().int().min(1).max(366),budget:amount.nullable().default(null),rooms:z.number().int().min(1).max(100),people:z.number().int().min(1).max(1000).optional(),skiDays:z.number().int().min(0).max(367).optional(),packageIds:z.array(z.uuid()).max(1000).default([]),fees:z.array(fee).max(50).default([])}).superRefine((p,c)=>{
  if(new Set(p.fees.map(f=>f.id)).size!==p.fees.length)c.addIssue({code:'custom',path:['fees'],message:'费用 ID 不得重复'});
  if(p.skiDays!==undefined&&p.skiDays>p.nights+1)c.addIssue({code:'custom',path:['skiDays'],message:'滑雪天数超过出行天数'});
});
export const planningRecord=z.strictObject({id:z.uuid(),sessionId:text,createdAt:z.iso.datetime(),conditions, confirmedByCard:z.boolean().default(false), supersededBy:z.uuid().nullable().default(null),status:z.enum(['running','complete','stopped']).default('running')});
export type Planning=z.infer<typeof planningRecord>;
export const segment=z.strictObject({packageId:z.uuid(),revision:z.number().int().min(1),start:z.iso.date(),nights:z.number().int().min(1).max(366)});
export const resultRecord=z.strictObject({id:z.uuid(),planningId:z.uuid(),sessionId:text,createdAt:z.iso.datetime(),plan:planRecord,checks:z.array(text),switches:z.number().int().nonnegative(),estimated:z.boolean()});
export type Calculation=z.infer<typeof resultRecord>;
const charge=z.strictObject({purpose:text,amount,rooms:z.number().int().min(1).max(100).optional(),extraPaymentId:z.string().trim().min(1).max(80).optional()});
export const scriptOutput=z.strictObject({daily:z.array(z.strictObject({date:z.iso.date(),packageId:z.uuid(),surcharge:amount.optional(),charges:z.array(charge).max(400).optional(),basis:text}).refine(row=>(row.surcharge===undefined)!==(row.charges===undefined),'请提供 charges 明细，不能同时提供 surcharge')).min(1).max(366),coverage:z.array(z.strictObject({feeId:text,quantity:z.number().nonnegative(),basis:text})).max(50),total:amount});
export const dateAfter=(start:string,n:number)=>new Date(Date.parse(start+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export class PlanningError extends Error {constructor(public kind:'technical'|'business',message:string){super(`${kind==='technical'?'技术错误':'候选不合格'}：${message}`);}}
export function validate<T>(schema:z.ZodType<T>,value:unknown):T {
 const r=schema.safeParse(value);if(r.success)return r.data;
 throw new PlanningError('technical',r.error.issues.map(i=>`${i.path.map((p,j)=>typeof p==='number'?`[${p}]`:`${j?'.':''}${String(p)}`).join('')||'参数'}：${i.message}`).join('\n'));
}
export function validateSegments(p:Planning,items:z.infer<typeof segment>[],packages:PackageRecord[]) {
 let next=p.conditions.start;const usage=new Map<string,number>();
 for(const [i,s] of items.entries()){
  const pkg=packages.find(x=>x.id===s.packageId);
  if(!pkg||pkg.completeness!=='complete'||extraPaymentUnknowns(pkg).length||pkg.voided)throw new PlanningError('business',`items[${i}]：套餐不存在、已作废或资料不完整`);
  if(pkg.revision!==s.revision)throw new PlanningError('business',`items[${i}].revision：套餐已变更，当前版本 ${pkg.revision}`);
  if(!p.conditions.packageIds.includes(pkg.id))throw new PlanningError('business',`items[${i}]：套餐不在确认范围内`);
  if(s.start!==next)throw new PlanningError('business',`items[${i}].start：须从 ${next} 连续入住，不得重叠或留空`);
  next=dateAfter(s.start,s.nights);
  if(!pkg.validFrom||!pkg.validTo||s.start<pkg.validFrom||dateAfter(s.start,s.nights-1)>pkg.validTo)throw new PlanningError('business',`items[${i}]：入住夜超出有效期`);
  for(let n=0;n<s.nights;n++)if(pkg.unavailableDates?.includes(dateAfter(s.start,n)))throw new PlanningError('business',`items[${i}]：包含不可用日期`);
  const units=s.nights*p.conditions.rooms;
  usage.set(pkg.id,(usage.get(pkg.id)??0)+units);
  if(pkg.splitAllowed===false&&(s.nights!==pkg.nights||p.conditions.rooms!==1||usage.get(pkg.id)!==units))throw new PlanningError('business',`items[${i}]：不可拆分套餐须整份连续使用`);
 }
 if(next!==dateAfter(p.conditions.start,p.conditions.nights))throw new PlanningError('business','items：住宿安排没有完整覆盖本次行程');
 for(const [id,nights] of usage){const pkg=packages.find(x=>x.id===id)!;if(nights>(pkg.nights??0)-(pkg.usedNights??0))throw new PlanningError('business',`套餐「${pkg.name}」剩余间夜不足`);}
}
export function calculate(p:Planning,items:z.infer<typeof segment>[],packages:PackageRecord[],raw:unknown,title:string,reason:string):Calculation {
 validateSegments(p,items,packages);const output=validate(scriptOutput,raw);
 const expected=items.flatMap(s=>Array.from({length:s.nights},(_,i)=>({date:dateAfter(s.start,i),packageId:s.packageId})));
 if(output.daily.length!==expected.length||output.daily.some((d,i)=>d.date!==expected[i].date||d.packageId!==expected[i].packageId))throw new PlanningError('technical','daily：须按行程顺序逐夜列出费用，不得缺失、重复或引用其他套餐');
 const allocations=new Map<string,number>();const allocation:string[]=[];
 for(const pkg of packages){
  const used=items.filter(s=>s.packageId===pkg.id).reduce((a,s)=>a+s.nights*p.conditions.rooms,0);if(!used)continue;
  const price=pkg.purchaseStatus==='purchased'?pkg.paid:pkg.quote;
  if(price===null||!pkg.nights)throw new PlanningError('business',`套餐「${pkg.name}」缺少可计算成本`);
  const cost=pkg.splitAllowed?Math.round(price*used/pkg.nights):price;
  validate(amount,cost);allocations.set(pkg.id,cost);
  allocation.push(`${pkg.name}：套餐本价 ${price} 分${pkg.splitAllowed?` × ${used}/${pkg.nights} 间夜`:'（整份计入）'} = ${cost} 分；补款按明细归属另计`);
 }
 const share=(value:number,index:number,count:number)=>Math.floor(value/count)+(index<value%count?1:0);
 const daily=output.daily.map(row=>{
  const pkg=packages.find(pkg=>pkg.id===row.packageId)!;
  const rows=output.daily.filter(d=>d.packageId===row.packageId),index=rows.indexOf(row),cost=allocations.get(row.packageId)!;
  const base=share(cost,index,rows.length);
  const payments=pkg.extraPayments??[];
  if(payments.length&&row.surcharge!==undefined)throw new PlanningError('technical','已有补款明细，必须返回 charges 并引用 extraPaymentId，不能再叠加 surcharge');
  const applicable=payments.filter(payment=>payment.scope==='package'||payment.date===row.date);
  const seen=new Set<string>(),purposes=new Map<string,number>(),details:string[]=[];
  let extraPaid=0,extraPending=row.surcharge??0;
  for(const item of row.charges??[]){
   const linked=applicable.find(payment=>payment.id===item.extraPaymentId);
   const coveredRooms=item.rooms??(linked?.scope==='date'?linked.rooms!:p.conditions.rooms);
   const roomTotal=(purposes.get(item.purpose)??0)+coveredRooms;
   if(roomTotal>p.conditions.rooms)throw new PlanningError('technical',`补款用途重复或覆盖房间数超出本次：${item.purpose}`);
   purposes.set(item.purpose,roomTotal);
   if(!item.extraPaymentId){
    extraPending+=item.amount;details.push(`${item.purpose}：尚需 ${item.amount} 分`);continue;
   }
   if(seen.has(item.extraPaymentId))throw new PlanningError('technical','补款明细重复引用');
   seen.add(item.extraPaymentId);
   const payment=applicable.find(payment=>payment.id===item.extraPaymentId);
   if(!payment)throw new PlanningError('technical','补款明细不属于该套餐或日期；改期不能自动转用');
   if(item.purpose!==payment.purpose)throw new PlanningError('technical','补款用途与明细不一致');
   if((payment.scope==='date'&&payment.rooms!==coveredRooms)||(payment.scope==='package'&&coveredRooms!==p.conditions.rooms))throw new PlanningError('business','补款覆盖房间数与本次不一致，请先核对并拆分适用费用');
   let paid=payment.paid!,pending=payment.settled?0:payment.total!-paid;
   if(payment.scope==='package'){
    const used=rows.length*p.conditions.rooms,ratio=pkg.splitAllowed?used/pkg.nights!:1;
    const total=Math.round((paid+pending)*ratio),allocatedPaid=Math.round(paid*ratio);
    paid=share(allocatedPaid,index,rows.length);pending=share(total-allocatedPaid,index,rows.length);
   }
   if(item.amount!==paid+pending)throw new PlanningError('technical',`补款金额 ${item.purpose} 应为 ${paid+pending} 分（已付 ${paid}，尚需 ${pending}）；已结清以实际支付为准`);
   extraPaid+=paid;extraPending+=pending;details.push(`${item.purpose}：已付 ${paid} 分，尚需 ${pending} 分${payment.settled?'（商家确认结清）':''}`);
  }
  if(applicable.some(payment=>!seen.has(payment.id)))throw new PlanningError('technical','遗漏本次适用的补款明细，请逐项引用 extraPaymentId');
  return {date:row.date,packageId:row.packageId,base,extraPaid:validate(amount,extraPaid),extraPending:validate(amount,extraPending),amount:validate(amount,base+extraPaid+extraPending),basis:`套餐本价分摊 ${base} 分；已付补款 ${extraPaid} 分；尚需补款 ${extraPending} 分。${details.join('；')}。${row.basis}`};
 });
 const coverage=new Map(output.coverage.map(c=>[c.feeId,c]));
 if(coverage.size!==output.coverage.length||[...coverage.keys()].some(id=>!p.conditions.fees.some(f=>f.id===id)))throw new PlanningError('technical','coverage：费用 ID 重复或不在已确认费用中');
 const sharedCosts=p.conditions.fees.map(f=>{const c=coverage.get(f.id);if((c?.quantity??0)>f.quantity)throw new PlanningError('technical',`coverage.${f.id}：权益覆盖数量超过需求`);return {label:f.label,amount:validate(amount,Math.round((f.quantity-(c?.quantity??0))*f.unitPrice)),basis:`需求 ${f.quantity}，套餐覆盖 ${c?.quantity??0}，单价 ${f.unitPrice} 分。${f.basis}${c?'；抵扣依据：'+c.basis:''}`};});
 const total=validate(amount,[...daily,...sharedCosts].reduce((sum,r)=>sum+r.amount,0));
 if(output.total!==total)throw new PlanningError('technical',`total：收到 ${output.total} 分，按套餐分摊、逐日补款和剩余共同费用应为 ${total} 分`);
 if(p.conditions.budget!==null&&total>p.conditions.budget)throw new PlanningError('business',`整趟总成本 ${total} 分超过预算 ${p.conditions.budget} 分`);
 const id=crypto.randomUUID(),createdAt=new Date().toISOString();
 const plan=planRecord.parse({id,schemaVersion:1,costVersion:2,createdAt,sessionId:p.sessionId,title,start:p.conditions.start,nights:p.conditions.nights,budget:p.conditions.budget,total,paid:null,pending:null,reason,allocation:allocation.join('\n'),estimates:p.conditions.fees.map(f=>({label:f.label,amount:Math.round(f.quantity*f.unitPrice),basis:f.basis})),items,daily,sharedCosts,unknowns:[],packages:packages.map(snapshot=>({id:snapshot.id,revision:snapshot.revision,snapshot}))});
 return resultRecord.parse({id,planningId:p.id,sessionId:p.sessionId,createdAt,plan,checks:['行程连续且完整','套餐版本与资料状态已核查','有效期、禁用日期、剩余间夜和拆分约束通过','整趟成本加总校验通过'],switches:items.length-1,estimated:p.conditions.fees.some(f=>f.source==='estimate')});
}
