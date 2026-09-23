import React, {useEffect,useState} from 'react';
import {packageMetadata,purchaseLabels} from './packages.ts';
const money=n=>n===null?'待确认':`${(n/100).toFixed(2)} 元`;
export function savedPackage(block) {
  return block&&'kind' in block&&!block.isError&&!block.parentCallId?packageMetadata(block.meta):null;
}
export function PackageCard({record:p,onOpen,saved=false}) {
  return <article className="snow trip-card snow-package-card" data-package-id={p.id} data-revision={p.revision}><div className="card-body">
    <div className="card-meta"><span>{saved?'已保存 · ':''}{purchaseLabels[p.purchaseStatus]}</span><span>{p.completeness==='incomplete'?'待补全':'资料完整'}</span></div>
    <h3>{p.name}</h3><p>{p.description}</p><p>适用酒店：{p.hotels===null?'待确认':p.hotels.join('、')||'已确认无'}</p>
    <p>总间夜：{p.nights??'待确认'} · 已用：{p.usedNights??'待确认'}</p>
    <dl><dt>报价</dt><dd>{money(p.quote)}</dd><dt>实付</dt><dd>{money(p.paid)}</dd><dt>已付额外补款</dt><dd>{money(p.paidExtra)}</dd></dl>
    <p className="muted">待补全：{p.unknowns.join('、')||'无'}</p>
    <details><summary>查看资料与来源</summary><p>有效期：{p.validFrom??'待确认'} — {p.validTo??'待确认'}</p><p>房型：{p.roomType??'待确认'} · 雪场：{p.resort??'待确认'}</p><p>拆分：{p.splitRule??'待确认'}</p><p>补款规则：{p.surchargeRules===null?'待确认':p.surchargeRules.join('；')||'已确认无'}</p><p>不可用日期：{p.unavailableDates===null?'待确认':p.unavailableDates.join('、')||'已确认无'}</p><p>作废：{p.voided===null?'待确认':p.voided?'是':'否'}</p>{p.sources.map((s,i)=><p key={i}>消息 #{s.messageSeq} · {s.nature==='inference'?'推断':s.nature==='user-supplement'?'用户补充':'原文'}：{s.text}</p>)}</details>
    <small>{p.id} · 版本 {p.revision}{saved?' · 保存时快照':''}</small>
    {onOpen&&<button onClick={()=>onOpen(p.sessionId)}>打开相关会话</button>}
  </div></article>;
}
export function SavedPackageCard({block}) {
  const record=savedPackage(block);
  if(record)return <div className="snow"><PackageCard record={record} saved/></div>;
  const content=Array.isArray(block?.content)?block.content.filter(c=>c?.type==='text'&&typeof c.text==='string').map(c=>c.text).join('\n'):'';
  return <details><summary>snow_save_packages · {block?.isError?'保存失败':block&&'kind' in block?'工具结果':'等待确认或保存'}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{content||'暂无结果'}</pre></details>;
}
export function PackageOverview({actions,refreshKey,onCreate,onOpen}) {
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    actions.listPackages().then(rows=>{if(active)setRows(rows);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[actions,refreshKey]);
  return <main className="workspace"><header className="topbar"><span>我的雪季 / 套餐概览</span><button onClick={onCreate}>录入套餐</button></header><div className="page"><div className="page-title"><span className="eyebrow">我的套餐资料</span><h1>下一程，从这里开始。</h1><p>在会话中整理套餐，确认后保存在本机。未知信息可以以后补全。</p></div>
    {error?<p className="error" role="alert">读取失败：{error}</p>:loading?<p role="status">正在读取套餐…</p>:rows.length?<div className="cards">{rows.map(p=><PackageCard key={p.id} record={p} onOpen={onOpen}/>)}</div>:<div className="empty"><h3>还没有套餐资料</h3><p>把套餐说明粘贴给助理，未购买或信息不完整也可以保存。</p><button className="primary" onClick={onCreate}>开始文字录入</button></div>}
  </div></main>;
}
