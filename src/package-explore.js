// 宿主金额单位为分；文字规则保留原文，不推算逐晚补款。
export function packageStats(rows) {
  const known = key => rows.filter(p=>p[key]!==null);
  return {
    count:rows.length,
    nights:known('nights').reduce((sum,p)=>sum+p.nights,0),
    nightsUnknown:rows.length-known('nights').length,
    paid:rows.reduce((sum,p)=>sum+(p.paid??0)+(p.paidExtra??0),0),
    paidUnknown:rows.filter(p=>p.paid===null||p.paidExtra===null).length,
    regions:[...new Set(rows.map(p=>p.region).filter(Boolean))],
    regionsUnknown:rows.filter(p=>p.region===null).length,
  };
}
export function packageCandidates(rows,filter,sort) {
  return rows.filter(p=>(filter.region==='全部目的地'||p.region===null||p.region===filter.region)&&
    [p.name,p.description,p.resort,...(p.hotels??[])].filter(Boolean).join(' ').toLowerCase().includes(filter.query.toLowerCase()))
    .map(p=>{
      const notes=[];
      const nights=filter.nights?Number(filter.nights):p.nights;
      if(p.voided)notes.push('已作废，不可用于出行');
      if(p.purchaseStatus!=='purchased')notes.push('尚未确认购买，使用权益前需核实');
      if(p.region===null)notes.push('目的地待确认');
      if(!p.validFrom||!p.validTo||!nights)notes.push('有效期或住宿晚数待确认，暂不能核对完整行程');
      const last=nights?new Date(Date.parse(filter.start+'T00:00:00Z')+(nights-1)*86400000).toISOString().slice(0,10):filter.start;
      if((p.validFrom&&filter.start<p.validFrom)||(p.validTo&&last>p.validTo))notes.push('所选日期超出有效期');
      if(p.unavailableDates?.some(d=>d>=filter.start&&d<=last))notes.push('所选行程含不可用日期');
      if(p.nights!==null&&nights>p.nights)notes.push('所选住宿晚数超出套餐总间夜');
      if(p.nights!==null&&p.usedNights!==null&&nights>p.nights-p.usedNights)notes.push('剩余间夜不足');
      notes.push('逐晚补款及使用条件待核对，暂不计算出行总价');
      if(filter.budget!=='')notes.push('补款未知，保留候选；尚不能确认符合预算');
      return {record:p,notes};
    }).sort((a,b)=>sort==='nights'?(b.record.nights??-1)-(a.record.nights??-1):0);
}
