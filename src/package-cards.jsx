import React, {useEffect,useState} from 'react';
import {packageMetadata,purchaseLabels,benefitSummary} from './packages.ts';
import {evaluateMetadata,planMetadata} from './plans.ts';
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
// 方案核算卡片：从持久化 metadata 读取搭配与快照，历史回放不读当前套餐。
export function EvaluateCard({block}) {
  const meta=block&&'kind' in block&&!block.isError?evaluateMetadata(block.meta):null;
  if(!meta)return <PlanFallback block={block} label="方案核算"/>;
  return <article className="snow trip-card snow-plan-card" aria-label="方案核算结果">
    {meta.combos.map((combo,index)=><section key={combo.packageId+index} className="snow-plan-combo">
      <h3>{combo.snapshot.name}</h3>
      <p>{combo.start} 入住 · {combo.nights} 晚 · {combo.snapshot.hotels?.join('、')??'酒店待确认'}</p>
      <p className="muted">整趟总价与逐日费用见脚本核算结果；版本第 {combo.revision} 版。</p>
    </section>)}
  </article>;
}
// 方案保存卡片：读保存时的方案快照，不读当前套餐。
export function PlanSavedCard({block}) {
  const meta=block&&'kind' in block&&!block.isError?planMetadata(block.meta):null;
  if(!meta)return <PlanFallback block={block} label="方案保存"/>;
  return <article className="snow trip-card snow-plan-card" aria-label="方案已保存" data-plan-id={meta.id}>
    <div className="card-meta"><span className="package-status">已保存方案</span></div>
    <h3>{meta.title}</h3>
    {meta.start&&<p>{meta.start} 入住{meta.nights!==null?` · ${meta.nights} 晚`:''}</p>}
    <dl className="package-prices"><dt>整趟总价</dt><dd>{money(meta.total)}</dd><dt>已付</dt><dd>{money(meta.paid)}</dd><dt>待付</dt><dd>{money(meta.pending)}</dd></dl>
    {meta.daily.length>0&&<div className="table-scroll"><table><thead><tr><th>日期</th><th>费用</th><th>依据</th></tr></thead><tbody>{meta.daily.map(row=><tr key={row.date+row.packageId}><td>{row.date}</td><td>{money(row.amount)}</td><td>{row.basis??''}</td></tr>)}</tbody></table></div>}
    {meta.reason&&<p className="package-description">{meta.reason}</p>}
    {meta.unknowns.length>0&&<p className="package-missing"><span>未知项</span>{meta.unknowns.join('、')}</p>}
    <small>保存时快照 · {meta.items.length} 个套餐</small>
  </article>;
}
export function PlanFallback({block,label='工具结果'}) {
  const content=Array.isArray(block?.content)?block.content.filter(c=>c?.type==='text'&&typeof c.text==='string').map(c=>c.text).join('\n'):'';
  return <details><summary>{label} · {block?.isError?'失败':block&&'kind' in block?'工具结果':'等待结果'}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{content||'暂无结果'}</pre></details>;
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
