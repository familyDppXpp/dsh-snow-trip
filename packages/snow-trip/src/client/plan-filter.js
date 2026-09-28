import {date,plusDays} from './ledger.js';

// 同一字段多选取并集，不同字段取交集；旧方案缺少标签时仅匹配未设置。
export function filterPlans(plans,filter) {
  const hasDates=!!(filter.start||filter.end);
  if(hasDates&&(!date(filter.start)||!date(filter.end)||filter.start>filter.end))return [];
  return plans.filter(plan=>(!hasDates||(plan.start!=null&&plan.nights!=null&&plan.start<=filter.start&&plusDays(plan.start,plan.nights)>=filter.end))&&
    (!filter.days?.length||(plan.nights!=null&&filter.days.includes(plan.nights+1)))&&
    (!filter.regions?.length||plan.packages?.some(entry=>filter.regions.includes(entry.snapshot.region)))&&
    ['booking','refund'].every(key=>!filter[key].length||filter[key].includes(plan.tracking?.[key]??''))&&
    (!filter.refundPolicy.length||filter.refundPolicy.includes(plan.tracking?.refundPolicy??'')));
}
export function tripDays(plans) {
  return [...new Set(plans.filter(plan=>plan.nights!=null).map(plan=>plan.nights+1))].sort((a,b)=>a-b);
}
export function planRegions(plans) {
  return [...new Set(plans.flatMap(plan=>(plan.packages??[]).map(entry=>entry.snapshot.region)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
}
export function refundPolicies(plans) {
  return [...new Set(plans.map(plan=>plan.tracking?.refundPolicy).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh-CN'));
}

export function sortPlans(plans,key='nights',direction='desc') {
  // 出行天数为晚数加一，与晚数的排序一致；同值保留原有保存时间顺序。
  return [...plans].sort((a,b)=>{
    const av=a[key],bv=b[key];
    if(av==null&&bv!=null)return 1;
    if(av!=null&&bv==null)return -1;
    return av==null?0:direction==='asc'?av-bv:bv-av;
  });
}
