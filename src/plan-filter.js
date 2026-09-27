import {date,plusDays} from './ledger.js';

export const planStatuses=[['confirmed','已确认'],['unreserved','未预约'],['','预约未设置']].flatMap(([booking,bookingLabel])=>
  [['refundable','可退'],['nonrefundable','不可退'],['','退改未设置']].map(([refund,refundLabel])=>
    [`${booking}:${refund}`,`${bookingLabel}${booking&&refund?'':' · '}${refundLabel}`]));

// 同一字段多选取并集，不同字段取交集；旧方案缺少标签时仅匹配未设置。
export function filterPlans(plans,filter) {
  const hasDates=!!(filter.start||filter.end);
  if(hasDates&&(!date(filter.start)||!date(filter.end)||filter.start>filter.end))return [];
  return plans.filter(plan=>(!hasDates||(plan.start!=null&&plan.nights!=null&&plan.start<=filter.start&&plusDays(plan.start,plan.nights)>=filter.end))&&
    (!filter.days?.length||(plan.nights!=null&&filter.days.includes(plan.nights+1)))&&
    (!filter.statuses.length||filter.statuses.includes(`${plan.tracking?.booking??''}:${plan.tracking?.refund??''}`))&&
    (!filter.refundPolicy.length||filter.refundPolicy.includes(plan.tracking?.refundPolicy??'')));
}
export function tripDays(plans) {
  return [...new Set(plans.filter(plan=>plan.nights!=null).map(plan=>plan.nights+1))].sort((a,b)=>a-b);
}
export function refundPolicies(plans) {
  return [...new Set(plans.map(plan=>plan.tracking?.refundPolicy).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
}
