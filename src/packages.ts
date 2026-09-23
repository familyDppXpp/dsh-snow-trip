import { z } from 'zod';

const text = z.string().trim().min(1).max(4000);
const optionalText = text.nullable().default(null);
const amount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().default(null);
const day = z.iso.date().nullable().default(null);
const list = z.array(text).max(100).nullable().default(null);
export const packageInput = z.strictObject({
  name: optionalText, description: optionalText, hotels: list,
  roomType: optionalText, resort: optionalText, region: optionalText,
  nights: z.number().int().min(1).max(100000).nullable().default(null),
  purchaseStatus: z.enum(['unknown','unpurchased','purchased']).default('unknown'),
  quote: amount, paid: amount, paidExtra: amount,
  validFrom: day, validTo: day, splitRule: optionalText,
  surchargeRules: list, unavailableDates: z.array(z.iso.date()).max(3660).nullable().default(null),
  usedNights: z.number().int().min(0).max(100000).nullable().default(null),
  voided: z.boolean().nullable().default(null),
  sources: z.array(z.strictObject({
    messageSeq: z.number().int().min(1), text,
    nature: z.enum(['fact','user-supplement','inference']),
  })).min(1).max(30).optional(),
  pendingQuestions: z.array(text).max(100).default([]),
}).superRefine((p,ctx)=>{
  if(![p.name,p.description,p.roomType,p.resort,p.region,p.nights,p.quote,p.paid,p.paidExtra,p.usedNights,p.validFrom,p.validTo,p.splitRule].some(v=>v!==null)&&!p.hotels?.length&&!p.surchargeRules?.length&&!p.unavailableDates?.length)
    ctx.addIssue({code:'custom',message:'至少需要一项真实套餐信息'});
  if(p.validFrom&&p.validTo&&p.validFrom>p.validTo)ctx.addIssue({code:'custom',message:'有效期结束早于开始'});
  if(p.nights!==null&&p.usedNights!==null&&p.usedNights>p.nights)ctx.addIssue({code:'custom',message:'已使用间夜超出总量'});
  if(p.purchaseStatus==='unpurchased'&&((p.paid??0)>0||(p.paidExtra??0)>0||(p.usedNights??0)>0))ctx.addIssue({code:'custom',message:'未购买与实付或使用信息冲突，请澄清'});
});
export const fieldLabels = {
  name:'名称',description:'说明',hotels:'适用酒店',roomType:'房型',resort:'雪场',region:'地区',nights:'总间夜',
  purchaseStatus:'购买状态',quote:'报价',paid:'实付',paidExtra:'已付额外补款',validFrom:'有效期开始',validTo:'有效期结束',
  splitRule:'拆分规则',surchargeRules:'补款规则',unavailableDates:'不可用日期',usedNights:'已使用间夜',voided:'作废状态',
} as const;
export function normalizePackage(input: unknown) {
  const p=packageInput.parse(input);
  const unknowns=[...Object.entries(fieldLabels).filter(([key])=>p[key as keyof typeof fieldLabels]===null||(key==='purchaseStatus'&&p.purchaseStatus==='unknown')).map(([,label])=>label),...p.pendingQuestions];
  return {...p,name:p.name??'未命名套餐',unknowns,completeness:unknowns.length?'incomplete' as const:'complete' as const};
}
const normalized = packageInput.safeExtend({name:text,unknowns:z.array(text),completeness:z.enum(['incomplete','complete'])});
export const packageRecord = normalized.safeExtend({
  id:z.uuid(),revision:z.number().int().min(1),schemaVersion:z.literal(1),
  createdAt:z.iso.datetime(),updatedAt:z.iso.datetime(),sessionId:text,
  sources:z.array(z.strictObject({sessionId:text,messageSeq:z.number().int().min(1),text,nature:z.enum(['fact','user-supplement','inference'])})).min(1).max(30),
});
export type PackageRecord=z.infer<typeof packageRecord>;
export function packageMetadata(meta: unknown): PackageRecord|null {
  const result=z.strictObject({version:z.literal(1),record:packageRecord}).safeParse(meta);
  return result.success?result.data.record:null;
}
export const purchaseLabels={unknown:'待确认',unpurchased:'未购买',purchased:'已购买'};
export function packageSummary(p: ReturnType<typeof normalizePackage>) {
  return Object.entries(fieldLabels).map(([key,label])=>{
    const value=p[key as keyof typeof fieldLabels];
    const shown=key==='purchaseStatus'?purchaseLabels[p.purchaseStatus]:value===null?'待确认':Array.isArray(value)?(value.length?value.join('；'):'已确认无'):['quote','paid','paidExtra'].includes(key)?`${(Number(value)/100).toFixed(2)} 元`:typeof value==='boolean'?(value?'是':'否'):String(value);
    return `${label}：${shown}`;
  }).concat(`待补全：${p.unknowns.join('、')||'无'}`, ...(p.sources??[]).map(s=>`来源消息 #${s.messageSeq}（${s.nature}）：${s.text}`)).join('\n');
}
