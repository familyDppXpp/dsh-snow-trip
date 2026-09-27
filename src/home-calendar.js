import {date,plusDays} from './ledger.js';

const unique=rows=>[...new Map(rows.map(row=>[row.id,row])).values()];
const excluded=p=>p.voided===true||(p.nights!=null&&p.usedNights!=null&&p.nights-p.usedNights<=0);
const hasBoundary=p=>!!(date(p.validFrom)||date(p.validTo));
export const localDay=value=>`${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`;

function tripRange({start,nights}) {
  const first=date(start);
  return first&&Number.isInteger(nights)&&nights>=1&&nights<=366?[first,plusDays(first,nights)]:null;
}
export function planDateRanges(plan) {
  const total=tripRange(plan);
  return total?[total]:(plan.items??[]).map(tripRange).filter(Boolean);
}

export function calendarDay(packages,plans,day) {
  const result={packages:[],pendingPackages:[],plans:[]};
  for(const p of unique(packages)){
    const from=date(p.validFrom),to=date(p.validTo);
    if(excluded(p)||!hasBoundary(p)||(from&&day<from)||(to&&day>to)||p.unavailableDates?.includes(day))continue;
    result[from&&to&&Array.isArray(p.unavailableDates)?'packages':'pendingPackages'].push(p);
  }
  result.plans=unique(plans).filter(plan=>planDateRanges(plan).some(([start,end])=>start<=day&&day<=end));
  return result;
}
export function undatedRecords(packages,plans) {
  return {packages:unique(packages).filter(p=>!excluded(p)&&!hasBoundary(p)),plans:unique(plans).filter(p=>!planDateRanges(p).length)};
}

export function filterCalendarDay(day,filters) {
  const show=type=>!filters.length||filters.includes(type);
  return {plans:day.plans.filter(p=>show(p.tracking?.booking==='confirmed'?'confirmed':'draft')),packages:show('packages')?day.packages:[],pendingPackages:show('pending')?day.pendingPackages:[]};
}
export function seasonCalendar(packages,plans,year) {
  const months=[11,12,13,14].map(month=>new Date(year,month,1));
  const days=new Map(),packageIds=new Set(),planIds=new Set();
  let plannedDays=0;
  for(const month of months){
    const last=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
    for(let d=1;d<=last;d++){
      const key=localDay(new Date(month.getFullYear(),month.getMonth(),d)),value=calendarDay(packages,plans,key);
      days.set(key,value);
      value.packages.forEach(p=>packageIds.add(p.id));value.plans.forEach(p=>planIds.add(p.id));
      if(value.plans.length)plannedDays++;
    }
  }
  return {months,days,packageCount:packageIds.size,planCount:planIds.size,plannedDays};
}
