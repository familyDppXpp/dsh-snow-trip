import React, {useEffect,useState,useRef,useId} from 'react';
import {PlanQuestionCard} from './plan-question-card.jsx';
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
// 方案核算卡片：从持久化 metadata 读取搭配、快照与脚本结果，历史回放不读当前套餐。
export function EvaluateCard({block}) {
  if(block?.meta?.status==='computed'&&block.meta.resultId)return <article className="snow snow-plan-card" role="status"><h3>候选核算通过</h3><p>已通过 {block.meta.passed} 份；完成比较后统一展示。</p></article>;
  const meta=block&&'kind' in block&&!block.isError?evaluateMetadata(block.meta):null;
  if(!meta)return <PlanFallback block={block} label="方案核算"/>;
  const yuan=n=>n==null?'待确认':`${(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} 元`;
  const rows=Array.isArray(meta.results?.combos)?meta.results.combos:[];
  return <article className="snow trip-card snow-plan-card" aria-label="方案核算结果">
    {rows.length?rows.map((combo,index)=><section key={index} className="snow-plan-combo">
      <h3>{combo.basis||'候选搭配'}</h3>
      {combo.total!=null&&<p className="snow-plan-total">整趟总价 <strong>{yuan(combo.total)}</strong></p>}
      {Array.isArray(combo.daily)&&combo.daily.length>0&&<div className="table-scroll"><table><thead><tr><th>日期</th><th>费用</th><th>依据</th></tr></thead><tbody>{combo.daily.map((row,i)=><tr key={i}><td>{row.date}</td><td>{yuan(row.amount)}</td><td>{row.basis??''}</td></tr>)}</tbody></table></div>}
      {Array.isArray(combo.checks)&&combo.checks.length>0&&<ul className="snow-plan-checks">{combo.checks.map((check,i)=><li key={i}>{check}</li>)}</ul>}
    </section>):null}
    {!rows.length&&meta.combos.map((combo,index)=><section key={combo.packageId+index} className="snow-plan-combo">
      <h3>{combo.snapshot.name}</h3>
      <p>{combo.start} 入住 · {combo.nights} 晚 · {combo.snapshot.hotels?.join('、')??'酒店待确认'}</p>
      <p className="muted">版本第 {combo.revision} 版；逐日费用见下方说明。</p>
    </section>)}
  </article>;
}
// 方案保存卡片：读保存时的方案快照，不读当前套餐。
export function PlanSavedCard({block}) {
  const meta=block&&'kind' in block&&!block.isError?planMetadata(block.meta):null;
  if(!meta)return <PlanFallback block={block} label="方案保存"/>;
  const yuan=n=>n==null?'待确认':`¥${(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
  const basis=text=>String(text??'').replace(/(\d+(?:\.\d+)?)\s*分(?!摊|钟)/g,(_,value)=>yuan(Number(value)));
  const nightly=meta.daily.length&&meta.daily.every(row=>row.amount!=null)?meta.daily.reduce((sum,row)=>sum+row.amount,0):null;
  const shared=meta.sharedCosts.reduce((sum,row)=>sum+row.amount,0);
  return <article className="snow trip-card snow-plan-card snow-saved-card" aria-label="方案已保存" data-plan-id={meta.id}>
    <header className="snow-saved-head"><div><span className="snow-saved-label">已保存 · {meta.items.length} 个套餐</span><h3>{meta.title}</h3>
    {meta.start&&<p>{meta.start} 入住{meta.nights!==null?` · ${meta.nights} 晚`:''}</p>}</div>
    <div className="snow-saved-total"><span>整趟总成本</span><strong>{yuan(meta.total)}</strong></div></header>
    {meta.reason&&<p className="snow-saved-reason">{basis(meta.reason)}</p>}
    <section className="snow-saved-breakdown" aria-label="总成本组成"><h4>总成本组成</h4><dl>
      <div><dt>逐晚费用小计 <small>套餐计入成本及日期补款，详见下表</small></dt><dd>{yuan(nightly)}</dd></div>
      {meta.sharedCosts.map((cost,index)=><div key={index}><dt>{cost.label}<small>整趟计一次{cost.basis?` · ${basis(cost.basis)}`:''}</small></dt><dd>{yuan(cost.amount)}</dd></div>)}
      <div className="snow-saved-sum"><dt>整趟总成本</dt><dd>{yuan(meta.total)}</dd></div>
    </dl>{nightly!=null&&meta.total!=null&&nightly+shared===meta.total?<p>{yuan(nightly)} 逐晚费用 + {yuan(shared)} 共同费用 = {yuan(meta.total)}</p>:<p>保存时的分项信息不完整或与总额不一致，需重新核对。</p>}
    {meta.allocation&&<p className="snow-saved-allocation">套餐计入依据：{basis(meta.allocation)}</p>}</section>
    {meta.daily.length>0&&<div className="table-scroll snow-saved-daily"><table aria-label={`${meta.title} 每日费用`}><thead><tr><th scope="col">日期</th><th scope="col">当晚费用</th><th scope="col">计算依据</th></tr></thead><tbody>{meta.daily.map(row=><tr key={row.date+row.packageId}><td>{row.date}</td><td>{yuan(row.amount)}</td><td>{basis(row.basis)}</td></tr>)}</tbody></table></div>}
    {meta.unknowns.length>0&&<p className="package-missing"><span>未知项</span>{meta.unknowns.join('、')}</p>}
    <small className="snow-saved-footnote">费用与套餐资料均为保存时快照</small>
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

export function PlanningToolCard({block}) {
 const data=block?.meta;
 if(data?.status==='save_results')return <article className="snow snow-plan-card"><h3>保存结果</h3>{data.items.map((r,i)=><p key={i}>{r.title??'方案'}：{r.status==='saved'?'已保存，可在已存方案查看':`未保存 · ${r.error}`}</p>)}</article>;
 if(data?.status==='prepared')return <p role="status">条件已确认，正在准备候选搭配。</p>;
 if(data?.planningId&&Array.isArray(data.results))return <p role="status">已通过 {data.passed} 份候选 · {data.comparisonComplete?'比较已完成':'尚未完成全部比较，已通过结果保留'}</p>;
 if(block?.isError)return <PlanFallback block={block} label="出行规划"/>;
 return null;
}


export function PreparedPlanCard({data}) {
 const card=useRef(null);
 useEffect(()=>{if(card.current?.getClientRects().length)card.current.scrollIntoView({block:'start'});},[data?.planningId]);
 const c=data?.conditions;
 if(!['prepared','adjusting'].includes(data?.status)||!c)return null;
 const legacy=data.status==='prepared'&&!data.confirmedByCard;
 const confirmed=data.status==='prepared'&&data.confirmedByCard===true;
 const yuan=n=>`¥${(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
 return <article ref={card} className="snow snow-plan-card snow-confirmed-plan" aria-label={legacy?"历史规划条件":confirmed?"已确认的出行条件":"待调整的出行条件"}>
  <header><span className="snow-confirmed-status">{legacy?'历史记录 · 确认方式未记录':confirmed?'✓ 已确认 · 只读记录':data.custom?'已提交补充 · 未确认':'已取消 · 未确认'}</span><h3>{legacy?'当时使用的规划条件':confirmed?'本次方案的生成依据':'本次待调整的条件'}</h3></header>
  <dl className="snow-confirmed-facts"><div><dt>入住日期</dt><dd>{c.start}</dd></div><div><dt>住宿晚数</dt><dd>{c.nights} 晚</dd></div><div><dt>房间数</dt><dd>{c.rooms} 间</dd></div>{c.people!=null&&<div><dt>出行人数</dt><dd>{c.people} 人</dd></div>}{c.skiDays!=null&&<div><dt>滑雪天数</dt><dd>{c.skiDays} 天</dd></div>}<div><dt>整趟预算</dt><dd>{c.budget==null?'不限':yuan(c.budget)}</dd></div></dl>
  <section><h4>参与搭配的套餐</h4><ul>{(data.packages??c.packageIds.map(id=>({id,name:id}))).map(p=><li key={p.id}>{p.name}</li>)}</ul></section>
  <section><h4>{legacy?'当时录入的共同费用':confirmed?'已确认的共同费用':'待确认的共同费用'}</h4>{c.fees.length?c.fees.map(f=><div className="snow-confirmed-fee" key={f.id}><p><strong>{f.label}</strong><span>{f.quantity} × {yuan(f.unitPrice)} = {yuan(Math.round(f.quantity*f.unitPrice))}</span></p><small>{f.source==='estimate'?(confirmed?'已接受估算':'待确认估算'):'用户提供'} · {f.basis}</small></div>):<p>本次未录入共同费用</p>}</section>
  {data.custom&&<section><h4>你的补充</h4><p style={{whiteSpace:'pre-wrap'}}>{data.custom}</p></section>}
  <p className="snow-plan-muted">{legacy?'旧记录未保存卡片确认凭据，不能据此认定你已点击确认。':confirmed?'以上为本次确认时的记录。套餐已含权益将在核算时抵扣，费用合计不代表最终整趟成本。':data.custom?'已将补充交给助理继续处理；以上条件与费用尚未确认。':'本次未确认条件与费用，等待继续调整。'}</p>
 </article>;
}


export function PlanInteractionCard({data}) {
 if(data?.conditions&&['prepared','adjusting'].includes(data.status))return <PreparedPlanCard data={data}/>;
 if(data?.version===1&&data.status==='saved'&&data.plan&&!data.interaction?.card?.results?.length)return <PlanSavedCard block={{kind:'tool-result',meta:{version:1,status:'saved',plan:data.plan}}}/>;
 const record=data?.interaction??(data?.status==='save_results'?{action:'save',stage:'results',items:data.items}:null);if(!record)return null;
 if(record.action==='save'){
  const selected=(record.card?.results??[]).flatMap((r,i)=>record.items?.some(item=>(item.resultId??item.planId)===r.resultId)?[i]:[]);
  return <div className="snow snow-plan-save-record">{record.card?.results?.length>0&&<PlanQuestionCard snapshot={{...record.card,stage:'results',selected}} outcome={record}/>}
  <div className="snow snow-saved-results">{record.items?.map((item,i)=>{
  let plan=item.plan??(data?.plan?.id===item.planId?data.plan:null);
  if(!plan&&item.status==='saved'){
   const snapshot=record.card?.results?.find(r=>r.resultId===(item.resultId??item.planId));
   if(snapshot){const {resultId,end,checks,switches,estimated,...stored}=snapshot;plan={...stored,allocation:Array.isArray(stored.allocation)?stored.allocation.join('\n')||null:stored.allocation,daily:stored.daily?.map(({hotel,...row})=>row)};}
  }
  const meta={version:1,status:'saved',plan};
  return item.status==='saved'&&planMetadata(meta)?<PlanSavedCard key={item.planId??i} block={{kind:'tool-result',meta}}/>:<article key={i} className="snow snow-plan-card"><h3>{item.title??'方案'} · {item.status==='saved'?'已保存':'保存失败'}</h3><p>{item.status==='saved'?'此条历史记录没有完整快照，请到已存方案查看。':item.error??'请重新检查'}</p></article>;
 })}</div></div>;
 }
 if(['cancel','supplement'].includes(record.action)&&record.card?.results?.length)return <PlanQuestionCard snapshot={{...record.card,stage:'results'}} outcome={record}/>;
 const title=record.action==='save'?'方案保存结果':record.action==='supplement'?'已提交补充':record.action==='cancel'?'已取消本次操作':'已选择后续操作';
 const c=record.conditions,results=record.card?.results??[];
 return <article className="snow snow-plan-card snow-confirmed-plan" aria-label="规划交互记录"><header><span className="snow-confirmed-status">只读 · 操作记录</span><h3>{title}</h3></header>
 {c&&<p>{c.start} 入住 · {c.nights} 晚 · {c.rooms} 间{c.people!=null?` · ${c.people} 人`:''}</p>}
 {results.length>0&&<section><h4>本次查看的方案</h4><ul>{results.map((r,i)=><li key={r.resultId??i}>{r.title} · {money(r.total)}</li>)}</ul></section>}
 {record.custom&&<section><h4>你的补充</h4><p style={{whiteSpace:'pre-wrap'}}>{record.custom}</p></section>}
 {record.action==='action'&&<p>{record.selected?.join('、')}</p>}
 {record.items?.map((item,i)=><p key={i}>{item.title??'方案'}：{item.status==='saved'?'已保存':`保存失败 · ${item.error??'请重新检查'}`}</p>)}
 {record.action!=='save'&&<p className="snow-plan-muted">{record.stage==='confirm'?'条件和费用尚未确认。':'本次操作未保存方案。'}{record.action==='supplement'?'已将补充交给助理继续处理。':''}</p>}
 </article>;
}

export function QuestionAnswerCard({data}) {
 const [active,setActive]=useState(0),id=useId();
 const questions=Array.isArray(data.questions)?data.questions:[];
 const answer=q=>data.answers.find(a=>a.id===q.id);
 const answered=q=>{const a=answer(q);return !!(a?.selected?.length||a?.custom);};
 return <article className="snow snow-question-record" aria-label="提问回答记录">
 <div className="snow-question-tabs" role="tablist" aria-label="已提交的问题">{questions.map((q,i)=><button type="button" role="tab" key={q.id??i} id={`${id}-tab-${i}`} aria-controls={`${id}-panel-${i}`} aria-selected={active===i} tabIndex={active===i?0:-1} onClick={()=>setActive(i)} onKeyDown={event=>{const next=event.key==='ArrowRight'?(i+1)%questions.length:event.key==='ArrowLeft'?(i+questions.length-1)%questions.length:event.key==='Home'?0:event.key==='End'?questions.length-1:null;if(next!==null){event.preventDefault();setActive(next);event.currentTarget.parentElement.children[next].focus();}}}>{q.header||`问题 ${i+1}`}<span className="snow-question-tab-status">{answered(q)?'✓':answer(q)?'已跳过':'未回答'}</span></button>)}</div>
 {questions.map((q,i)=>{const a=answer(q),selected=Array.isArray(a?.selected)?a.selected:[],options=Array.isArray(q.options)?q.options:[];return <section key={q.id??i} role="tabpanel" id={`${id}-panel-${i}`} aria-labelledby={`${id}-tab-${i}`} hidden={active!==i} tabIndex={0}>
 <p className="snow-question-prompt">{q.question}</p>{q.detail&&<p className="snow-question-detail">{q.detail}</p>}
 <div className="snow-question-options">{options.map((option,j)=>{const label=typeof option==='string'?option:option.label,chosen=selected.includes(label);return <div key={j} className={`snow-question-option${chosen?' is-selected':''}`} aria-label={`${label}，${chosen?'已选择':'未选择'}`}><span className="snow-question-number">{j+1}</span><div><strong>{label}</strong>{option.description&&<p>{option.description}</p>}</div>{chosen&&<span className="snow-question-check" aria-label="已选择">✓</span>}</div>;})}
 {selected.filter(label=>!options.some(o=>(typeof o==='string'?o:o.label)===label)).map((label,j)=><div key={`extra-${j}`} className="snow-question-option is-selected"><span aria-hidden="true">✓</span><strong>{label}</strong></div>)}
 <div className={`snow-question-option snow-question-custom${a?.custom?' is-selected':''}`}><span aria-hidden="true">✎</span><div><strong>其他（自由输入）</strong><p>{a?.custom?`补充：${a.custom}`:'未填写'}</p></div>{a?.custom&&<span className="snow-question-check" aria-label="已填写">✓</span>}</div>
 </div><footer className="snow-question-verdict"><span>{i+1} / {questions.length}</span><button disabled>{answered(q)?'已提交':a?'已跳过':'未回答'}</button></footer>
 </section>;})}
 </article>;
}
