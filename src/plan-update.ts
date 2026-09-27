import {isDeepStrictEqual} from 'node:util';
import {fieldLabels,extraPaymentDescription,benefitBasisLabels,purchaseLabels,type PackageRecord} from './packages.js';
import type {PlanRecord} from './plans.js';

export type ChangeRow={label:string;before:string;after:string;detail:boolean};
const money=(value:unknown)=>value==null?'未知':`¥${(Number(value)/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const labels:Record<string,string>={...fieldLabels,unknowns:'待补全信息',pendingQuestions:'待澄清问题',completeness:'资料完整状态',title:'方案名称',start:'入住日期',nights:'住宿晚数',budget:'预算',total:'整趟总成本',paid:'已付费用',pending:'待付费用',rooms:'房间数',people:'出行人数',skiDays:'滑雪天数',reason:'推荐说明',allocation:'分摊依据',fees:'共同费用需求',quantity:'数量',unitPrice:'单价',basis:'依据',label:'项目',amount:'金额',source:'来源',date:'日期',base:'套餐本价分摊',extraPaid:'已付补款',extraPending:'尚需补款'};
const amounts=new Set(['quote','paid','paidExtra','budget','total','pending','unitPrice','amount','base','extraPaid','extraPending']);
function shown(value:any,key=''):string {
 if(value==null)return '未知';
 if(amounts.has(key))return money(value);
 if(key==='extraPayments')return value.map(extraPaymentDescription).join('；')||'无';
 if(key==='purchaseStatus')return purchaseLabels[value as keyof typeof purchaseLabels];
 if(key.endsWith('Basis'))return benefitBasisLabels[value as keyof typeof benefitBasisLabels]??String(value);
 if(Array.isArray(value))return value.map(v=>shown(v)).join('；')||'无';
 if(typeof value==='object')return Object.entries(value).filter(([k])=>!['id','packageId'].includes(k)).map(([k,v])=>`${labels[k]??k}：${shown(v,k)}`).join('，');
 if(typeof value==='boolean')return value?'是':'否';
 return ({complete:'资料完整',incomplete:'待补全',user:'用户提供',estimate:'估算'} as Record<string,string>)[value]??String(value);
}
const row=(label:string,before:unknown,after:unknown,key='',detail=false):ChangeRow=>({label,before:shown(before,key),after:shown(after,key),detail});
const metadata=new Set(['id','revision','createdAt','updatedAt','sessionId','schemaVersion']);
const names=new Set(['name','region','resort']);
export function packageChanges(previous:PlanRecord,latest:PackageRecord[]) {
 const rows:ChangeRow[]=[];let requiresCalculation=false;
 for(const entry of previous.packages){
  const next=latest.find(p=>p.id===entry.id),old=entry.snapshot;
  if(!next){rows.push(row(`套餐「${old.name}」`,old.name,'已移除'));requiresCalculation=true;continue;}
  for(const key of new Set([...Object.keys(old),...Object.keys(next)])){
   if(metadata.has(key))continue;
   const before=old[key as keyof PackageRecord],after=next[key as keyof PackageRecord];
   if(isDeepStrictEqual(before,after))continue;
   rows.push(row(`套餐「${old.name}」· ${fieldLabels[key as keyof typeof fieldLabels]??labels[key]??key}${names.has(key)?'（资料修正）':''}`,before,after,key));
   if(!names.has(key))requiresCalculation=true;
  }
 }
 for(const next of latest)if(!previous.packages.some(p=>p.id===next.id)){rows.push(row('新增套餐',null,next.name));requiresCalculation=true;}
 return {rows,requiresCalculation};
}
export function updatePreview(previous:PlanRecord,candidate:PlanRecord) {
 const rows=packageChanges(previous,candidate.packages.map(p=>p.snapshot)).rows;
 for(const key of ['title','start','nights','budget','total','paid','pending','reason','allocation','unknowns'] as const){
  if(key==='total'||!isDeepStrictEqual(previous[key],candidate[key]))rows.push(row(labels[key],previous[key],candidate[key],key,['allocation','reason','unknowns'].includes(key)));
 }
 for(const key of ['rooms','people','skiDays','fees'] as const)if(!isDeepStrictEqual(previous.conditions?.[key],candidate.conditions?.[key]))rows.push(row(labels[key],previous.conditions?.[key],candidate.conditions?.[key],key,key==='fees'));
 const itinerary=(p:PlanRecord)=>p.items.flatMap(item=>Array.from({length:item.nights},(_,i)=>({packageId:item.packageId,date:new Date(Date.parse(item.start+'T00:00:00Z')+i*86400000).toISOString().slice(0,10)})));
 const resetTracking=previous.start!==candidate.start||previous.nights!==candidate.nights||!isDeepStrictEqual(itinerary(previous),itinerary(candidate))||(['rooms','people'] as const).some(k=>previous.conditions?.[k]!==candidate.conditions?.[k]);
 if(!isDeepStrictEqual(itinerary(previous),itinerary(candidate))){
  const describe=(p:PlanRecord)=>p.items.map(i=>`${i.start} · ${i.nights} 晚 · ${p.packages.find(e=>e.id===i.packageId)?.snapshot.name??'已移除套餐'}`).join('；');
  rows.push(row('住宿安排',describe(previous),describe(candidate)));
 }
 for(const key of ['daily','sharedCosts','estimates'] as const){
  const entries=(values:PlanRecord[typeof key])=>{
   const counts=new Map<string,number>();
   return new Map(values.map(value=>{const label='date' in value?value.date:value.label,count=counts.get(label)??0;counts.set(label,count+1);return [`${label}:${count}`,value] as const;}));
  };
  const before=entries(previous[key]),after=entries(candidate[key]);
  for(const id of new Set([...before.keys(),...after.keys()])){
   const a=before.get(id),b=after.get(id);if(isDeepStrictEqual(a,b))continue;
   const value=b??a!,label='date' in value?value.date:value.label;
   rows.push(row(`${{daily:'逐日费用',sharedCosts:'共同费用',estimates:'费用估算'}[key]} · ${label}${!a?'（新增）':!b?'（删除）':''}`,a??'无',b??'无','',true));
  }
 }
 const tracking=resetTracking?{booking:null,refund:null,refundPolicy:null}:previous.tracking;
 const plan={...candidate,tracking};
 const delta=previous.total==null||candidate.total==null?null:candidate.total-previous.total;
 return {plan,rows,resetTracking,costChange:delta==null?'金额未知，无法比较':delta===0?'总成本不变':`${delta>0?'增加':'减少'} ${money(Math.abs(delta))}`};
}
