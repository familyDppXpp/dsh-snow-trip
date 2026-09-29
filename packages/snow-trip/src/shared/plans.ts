import { z } from 'zod';
import { packageRecord } from './packages.ts';

const text = z.string().trim().min(1).max(4000);
const day = z.iso.date();
export const amount=z.number().int().nonnegative().safe();
export const fee=z.strictObject({id:text,label:text,quantity:z.number().nonnegative().max(100000),unitPrice:amount,basis:text,source:z.enum(['user','estimate'])});
export const conditions=z.strictObject({start:z.iso.date(),nights:z.number().int().min(1).max(366),budget:amount.nullable().default(null),rooms:z.number().int().min(1).max(100),people:z.number().int().min(1).max(1000).optional(),skiDays:z.number().int().min(0).max(367).optional(),packageIds:z.array(z.uuid()).max(1000).default([]),fees:z.array(fee).max(50).default([])}).superRefine((p,c)=>{
  if(new Set(p.fees.map(f=>f.id)).size!==p.fees.length)c.addIssue({code:'custom',path:['fees'],message:'费用 ID 不得重复'});
  if(p.skiDays!==undefined&&p.skiDays>p.nights+1)c.addIssue({code:'custom',path:['skiDays'],message:'滑雪天数超过出行天数'});
});

// 存储与业务口径统一为非负整数分；工具输入用元，经 toCents 校验换算。
const centsAmount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
const itemEntry = z.strictObject({
  packageId: z.uuid(), revision: z.number().int().min(1),
  nights: z.number().int().min(1).max(366), start: day,
});

export const planTracking = z.strictObject({
  booking: z.enum(['confirmed','unreserved']).nullable(),
  refund: z.enum(['refundable','nonrefundable']).nullable(),
  refundPolicy: text.nullable(),
}).superRefine((value,ctx)=>{
  if(value.refund==='refundable'&&!value.refundPolicy)ctx.addIssue({code:'custom',path:['refundPolicy'],message:'可退时请提供可退策略'});
  if(value.refund!=='refundable'&&value.refundPolicy!==null)ctx.addIssue({code:'custom',path:['refundPolicy'],message:'仅可退状态可记录可退策略'});
});
export const planTrackingPatch=z.strictObject({
  booking:planTracking.shape.booking.optional(),
  refund:planTracking.shape.refund.optional(),
  refundPolicy:planTracking.shape.refundPolicy.optional(),
}).refine(value=>Object.values(value).some(item=>item!==undefined),'请提供至少一个要更新的字段');
export type PlanTrackingPatch=z.infer<typeof planTrackingPatch>;

// 会话 LLM 输入的方案对象，金额单位为元。
export const planInput = z.strictObject({
  title: z.string().trim().min(1).max(200),
  start: day.nullable().default(null),
  nights: z.number().int().min(1).max(366).nullable().default(null),
  budget: z.number().min(0).nullable().default(null),
  total: z.number().min(0).nullable().default(null),
  paid: z.number().min(0).nullable().default(null),
  pending: z.number().min(0).nullable().default(null),
  reason: text.nullable().default(null),
  allocation: text.nullable().default(null),
  estimates: z.array(z.strictObject({ label: text, amount: z.number().min(0), basis: text })).max(50).default([]),
  items: z.array(itemEntry).min(1).max(20),
  daily: z.array(z.strictObject({ date: day, packageId: z.uuid(), amount: z.number().min(0).nullable(), basis: text.nullable().default(null) })).max(400).default([]),
  sharedCosts: z.array(z.strictObject({ label: text, amount: z.number().min(0), basis: text })).max(50).default([]),
  unknowns: z.array(text).max(100).default([]),
}).superRefine((p,ctx)=>{
  const ids=new Set(p.items.map(item=>item.packageId));
  for(const row of p.daily)if(!ids.has(row.packageId))ctx.addIssue({code:'custom',path:['daily'],message:`逐日费用引用的套餐 ${row.packageId} 不在本次搭配中`});
});

export function toCents(value: number|null|undefined): number|null {
  if(value===null||value===undefined)return null;
  if(!Number.isFinite(value)||value<0||!/^\d+(\.\d{1,2})?$/.test(String(value)))throw new Error(`金额：收到 ${value}；应为非负数字，最多两位小数。例如 1299.50（元）`);
  const [whole,fraction='']=String(value).split('.');
  const amount=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(amount>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('金额超出可保存范围');
  return Number(amount);
}

// 持久化方案记录：金额为分，packages 保存参与套餐的版本与完整快照。
export const planRecord = z.strictObject({
  conditions: conditions.optional(),
  tracking: planTracking.optional(),
  costVersion:z.literal(2).optional(),
  id: z.uuid(), schemaVersion: z.literal(1), createdAt: z.iso.datetime(), sessionId: text,
  title: z.string().trim().min(1).max(200),
  start: day.nullable(), nights: z.number().int().min(1).max(366).nullable(),
  budget: centsAmount, total: centsAmount, paid: centsAmount, pending: centsAmount,
  reason: text.nullable(), allocation: text.nullable(),
  estimates: z.array(z.strictObject({ label: text, amount: z.number().int().min(0), basis: text })).max(50),
  items: z.array(itemEntry).min(1).max(20),
  daily: z.array(z.strictObject({ date: day, packageId: z.uuid(), amount: centsAmount, basis: text.nullable(), base:centsAmount.optional(),extraPaid:centsAmount.optional(),extraPending:centsAmount.optional() })).max(400),
  sharedCosts: z.array(z.strictObject({ label: text, amount: z.number().int().min(0), basis: text })).max(50),
  unknowns: z.array(text).max(100),
  packages: z.array(z.strictObject({ id: z.uuid(), revision: z.number().int().min(1), snapshot: packageRecord })).min(1).max(20),
}).superRefine((p,ctx)=>{
  if(p.costVersion===2)for(const [index,row] of p.daily.entries()){
    if(row.base==null||row.extraPaid==null||row.extraPending==null||row.amount!==row.base+row.extraPaid+row.extraPending)ctx.addIssue({code:'custom',path:['daily',index],message:'新口径逐日成本须等于套餐本价、已付补款与尚需补款之和'});
  }
  const items=new Map<string,number>();
  for(const item of p.items)items.set(item.packageId,item.revision);
  for(const entry of p.packages){
    if(!items.has(entry.id))ctx.addIssue({code:'custom',path:['packages'],message:`快照套餐 ${entry.id} 不在搭配中`});
    else if(items.get(entry.id)!==entry.revision)ctx.addIssue({code:'custom',path:['packages'],message:`快照套餐 ${entry.id} 版本与搭配不一致`});
  }
  const ids=new Set(items.keys());
  for(const row of p.daily)if(!ids.has(row.packageId))ctx.addIssue({code:'custom',path:['daily'],message:`逐日费用引用的套餐 ${row.packageId} 不在本次搭配中`});
});
export type PlanRecord=z.infer<typeof planRecord>;

export const planMetaSchema=z.strictObject({version:z.literal(1),status:z.literal('saved'),plan:planRecord});
export function planMetadata(value:unknown):PlanRecord|null {
  const result=planMetaSchema.safeParse(value);
  return result.success?result.data.plan:null;
}

// snow_evaluate 结果卡片 metadata：保留搭配输入与套餐快照，历史回放不读当前套餐。
const comboMeta=z.strictObject({
  packageId:z.uuid(),revision:z.number().int().min(1),nights:z.number().int().min(1),start:day,snapshot:packageRecord,
});
export const evaluateMetaSchema=z.strictObject({
  version:z.literal(1),amountUnit:z.literal('元'),combos:z.array(comboMeta).min(1).max(10),
  results:z.unknown().optional(),error:z.string().optional(),
});
export type EvaluateMeta=z.infer<typeof evaluateMetaSchema>;
export function evaluateMetadata(value:unknown):EvaluateMeta|null {
  const result=evaluateMetaSchema.safeParse(value);
  return result.success?result.data:null;
}
