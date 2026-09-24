import { z } from 'zod';

const text = z.string().trim().min(1).max(4000);
const optionalText = text.nullable().default(null);
const amount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable().default(null);
const day = z.iso.date().nullable().default(null);
const list = z.array(text).max(100).nullable().default(null);
const included=z.boolean().nullable().default(null);
const quantity=z.number().int().min(1).max(100000).nullable().default(null);
export const benefitBasisLabels={order:'整单',night:'每晚',day:'每日',other:'其他口径'};
const basis=z.enum(['order','night','day','other']).nullable().default(null);
export const benefitGroups=[
  {label:'雪票',included:'skiIncluded',counts:['skiTickets'],basis:'skiBasis',rule:'skiRule'},
  {label:'早餐',included:'breakfastIncluded',counts:['breakfastPeople'],basis:'breakfastBasis',rule:'breakfastRule'},
  {label:'汤泉',included:'spaIncluded',counts:['spaPeople','spaVisits'],basis:'spaBasis',rule:'spaRule'},
] as const;
export const packageInput = z.strictObject({
  name: optionalText, description: optionalText, hotels: list,
  purchasePlatform: optionalText, roomType: optionalText, resort: optionalText, region: optionalText,
  nights: z.number().int().min(1).max(100000).nullable().default(null),
  purchaseStatus: z.enum(['unknown','unpurchased','purchased']).default('unknown'),
  quote: amount, paid: amount, paidExtra: amount,
  validFrom: day, validTo: day, splitRule: optionalText,
  skiIncluded:included,skiTickets:quantity,skiBasis:basis,skiRule:optionalText,
  breakfastIncluded:included,breakfastPeople:quantity,breakfastBasis:basis,breakfastRule:optionalText,
  spaIncluded:included,spaPeople:quantity,spaVisits:quantity,spaBasis:basis,spaRule:optionalText,
  splitAllowed:included,otherBenefits:list,
  surchargeRules: list, unavailableDates: z.array(z.iso.date()).max(3660).nullable().default(null),
  usedNights: z.number().int().min(0).max(100000).nullable().default(null),
  voided: z.boolean().nullable().default(null),
  pendingQuestions: z.array(text).max(100).default([]),
}).superRefine((p,ctx)=>{
  for(const group of benefitGroups){
    if(p[group.included]===false&&(group.counts.some(key=>p[key]!==null)||p[group.basis]!==null))ctx.addIssue({code:'custom',path:[group.included],message:`不包含${group.label}与数量或发放口径冲突，请明确清空数量和口径`});
  }

  if(![p.name,p.description,p.roomType,p.resort,p.region,p.nights,p.quote,p.paid,p.paidExtra,p.usedNights,p.validFrom,p.validTo,p.splitRule].some(v=>v!==null)&&!p.hotels?.length&&!p.surchargeRules?.length&&!p.unavailableDates?.length&&!benefitGroups.some(group=>p[group.included]!==null||group.counts.some(key=>p[key]!==null)||p[group.rule]!==null)&&p.splitAllowed===null&&!p.otherBenefits?.length)
    ctx.addIssue({code:'custom',message:'至少需要一项真实套餐信息'});
  if(p.validFrom&&p.validTo&&p.validFrom>p.validTo)ctx.addIssue({code:'custom',message:'有效期结束早于开始'});
  if(p.nights!==null&&p.usedNights!==null&&p.usedNights>p.nights)ctx.addIssue({code:'custom',message:'已使用间夜超出总量'});
  if(p.purchaseStatus==='unpurchased'&&((p.paid??0)>0||(p.paidExtra??0)>0||(p.usedNights??0)>0))ctx.addIssue({code:'custom',message:'未购买与实付或使用信息冲突，请澄清'});
});
export const fieldLabels = {
  name:'名称',description:'说明',hotels:'适用酒店',roomType:'房型',resort:'雪场',region:'地区',nights:'总间夜',
  purchasePlatform:'购买平台',purchaseStatus:'购买状态',quote:'报价',paid:'实付',paidExtra:'已付额外补款',validFrom:'有效期开始',validTo:'有效期结束',
  skiIncluded:'是否含雪票',skiTickets:'雪票张数',skiBasis:'雪票发放口径',skiRule:'雪票说明',
  breakfastIncluded:'是否含早餐',breakfastPeople:'早餐人数',breakfastBasis:'早餐供应口径',breakfastRule:'早餐说明',
  spaIncluded:'是否含汤泉',spaPeople:'汤泉人数',spaVisits:'汤泉次数',spaBasis:'汤泉使用口径',spaRule:'汤泉说明',splitAllowed:'是否可拆分',
  otherBenefits:'其他权益',splitRule:'拆分规则',surchargeRules:'补款规则',unavailableDates:'不可用日期',usedNights:'已使用间夜',voided:'作废状态',
} as const;
export function normalizePackage(input: unknown) {
  const p=packageInput.parse(input);
  const unknowns=[...Object.entries(fieldLabels).filter(([key])=>{
    for(const group of benefitGroups){
      if(key===group.rule)return p[group.basis]==='other'&&p[group.rule]===null;
      if((group.counts as readonly string[]).includes(key)||key===group.basis)return p[group.included]===true&&p[key as keyof typeof fieldLabels]===null;
    }
    if(key==='splitRule'||key==='otherBenefits')return false;
    return p[key as keyof typeof fieldLabels]===null||(key==='purchaseStatus'&&p.purchaseStatus==='unknown');
  }).map(([,label])=>label),...p.pendingQuestions];
  return {...p,name:p.name??'未命名套餐',unknowns,completeness:unknowns.length?'incomplete' as const:'complete' as const};
}
const normalized = packageInput.safeExtend({name:text,unknowns:z.array(text),completeness:z.enum(['incomplete','complete'])});
export const packageRecord = normalized.safeExtend({
  id:z.uuid(),revision:z.number().int().min(1),schemaVersion:z.literal(1),
  createdAt:z.iso.datetime(),updatedAt:z.iso.datetime(),sessionId:text,
  // 兼容读取旧记录；旧消息引用不再返回或写入。
  sources:z.unknown().optional(),
  sourceNotes:z.unknown().optional(),
}).transform(({sources,sourceNotes,...record})=>{
  return {...record,...normalizePackage(Object.fromEntries(Object.keys(packageInput.shape).map(key=>[key,record[key as keyof typeof record]])))};
});
export type PackageRecord=z.infer<typeof packageRecord>;
export function packageMetadata(meta: unknown): PackageRecord|null {
  const saved=saveMetadata(meta);
  if(saved)return saved.status==='saved'?saved.record:null;
  const result=z.strictObject({version:z.literal(1),record:packageRecord}).safeParse(meta);
  return result.success?result.data.record:null;
}
export const purchaseLabels={unknown:'待确认',unpurchased:'未购买',purchased:'已购买'};
export function packageSummary(p: ReturnType<typeof normalizePackage>) {
  return Object.entries(fieldLabels).map(([key,label])=>{
    const value=p[key as keyof typeof fieldLabels];
    const shown=key.endsWith('Basis')&&value!==null?benefitBasisLabels[value as keyof typeof benefitBasisLabels]:key==='purchaseStatus'?purchaseLabels[p.purchaseStatus]:value===null?'待确认':Array.isArray(value)?(value.length?value.join('；'):'已确认无'):['quote','paid','paidExtra'].includes(key)?`${(Number(value)/100).toFixed(2)} 元`:typeof value==='boolean'?(value?'是':'否'):String(value);
    return `${label}：${shown}`;
  }).concat(`待补全：${p.unknowns.join('、')||'无'}`).join('\n');
}

export const savePreviewSchema=z.object({callId:z.string(),previous:packageRecord.nullable(),preview:normalized});
const saveMetaSchema=z.object({version:z.literal(2),status:z.enum(['saved','adjusting']),previous:packageRecord.nullable(),preview:normalized,record:packageRecord.nullable()}).refine(v=>v.status!=='saved'||v.record!==null);
export function saveMetadata(value:unknown) {
  const result=saveMetaSchema.safeParse(value);
  return result.success?result.data:null;
}

export function benefitSummary(p:Partial<ReturnType<typeof normalizePackage>>) {
  return [...benefitGroups.map(group=>{
    const status=p[group.included];
    const counts=group.counts.map(key=>`${p[key]??'待确认'}${key==='skiTickets'?'张':key==='spaVisits'?'次':'人'}`).join(' · ');
    const scope=p[group.basis];
    const detail=status===false?'不包含':status===true?`包含 · ${counts} · ${scope?benefitBasisLabels[scope]:'口径待确认'}`:`是否包含待确认${group.counts.some(key=>p[key]!=null)?' · '+counts:''}${scope?' · '+benefitBasisLabels[scope]:''}`;
    return {label:group.label,text:detail+(p[group.rule]?'；'+p[group.rule]:'')};
  }),{label:'其他权益',text:p.otherBenefits==null?'未提供':p.otherBenefits.length?p.otherBenefits.join('\n'):'无'},{label:'拆分',text:(p.splitAllowed===true?'可拆分':p.splitAllowed===false?'不可拆分':'是否可拆分待确认')+(p.splitRule?'；'+p.splitRule:'')}];
}
