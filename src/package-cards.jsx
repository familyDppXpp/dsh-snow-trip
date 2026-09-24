import React, {useEffect,useState} from 'react';
import {packageMetadata,purchaseLabels,benefitSummary} from './packages.ts';
const money=n=>n===null?'待确认':`${(n/100).toFixed(2)} 元`;
export function savedPackage(block) {
  return block&&'kind' in block&&!block.isError&&!block.parentCallId?packageMetadata(block.meta):null;
}
export function PackageCard({record:p,onOpen,onDelete,saved=false}) {
  return <article className="snow trip-card snow-package-card" data-package-id={p.id} data-revision={p.revision}><div className="card-body">
    <div className="card-meta"><span className="package-status">{saved?'已保存 · ':''}{purchaseLabels[p.purchaseStatus]}</span><span>{p.completeness==='incomplete'?'待补全':'资料完整'}</span></div>
    <h3>{p.name}</h3>
    {p.description&&<p className="package-description">{p.description}</p>}
    <div className="package-facts"><p>购买平台：{p.purchasePlatform??'待确认'}</p><p>适用酒店：{p.hotels===null?'待确认':p.hotels.join('、')||'已确认无'}</p><p>住宿 {p.nights??'待确认'} 间夜 <span>· 已用 {p.usedNights??'待确认'}</span></p><p>有效期：{p.validFrom??'待确认'} — {p.validTo??'待确认'}</p></div>
    <PackageBenefits record={p}/>
    <dl className="package-prices"><dt>报价</dt><dd>{money(p.quote)}</dd><dt>实付</dt><dd>{money(p.paid)}</dd><dt>已付额外补款</dt><dd>{money(p.paidExtra)}</dd></dl>
    {p.unknowns.length>0&&<p className="package-missing"><span>待补全</span>{p.unknowns.join('、')}</p>}
    {saved&&<small>保存时快照</small>}
    {(onOpen||onDelete)&&<div className="package-actions">
    {onOpen&&<button className="primary package-open" onClick={()=>onOpen(p)}>{p.completeness==='incomplete'?'继续补全':'补充信息'} <span aria-hidden="true">→</span></button>}
    {onDelete&&<button className="package-delete" onClick={()=>onDelete(p)}>删除套餐</button>}
    </div>}
  </div></article>;
}
export function SavedPackageCard({block}) {
  const record=savedPackage(block);
  if(record)return <p>已保存套餐：{record.name} · 第 {record.revision} 版</p>;
  const content=Array.isArray(block?.content)?block.content.filter(c=>c?.type==='text'&&typeof c.text==='string').map(c=>c.text).join('\n'):'';
  return <details><summary>套餐保存 · {block?.isError?'保存失败':block&&'kind' in block?'工具结果':'等待确认或保存'}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{content||'暂无结果'}</pre></details>;
}
export function usePackages(actions,refreshKey) {
  const [attempt,setAttempt]=useState(0);
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    actions.listPackages().then(rows=>{if(active)setRows(rows);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[actions,refreshKey,attempt]);
  return {rows,error,loading,retry:()=>setAttempt(value=>value+1)};
}

export function PackageBenefits({record}) {
  return <section className="package-benefits" aria-label="包含权益"><h4>包含权益</h4><dl>{benefitSummary(record).map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.text}</dd></div>)}</dl></section>;
}
