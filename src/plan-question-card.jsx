// SNOW-06 方案问题卡（客户端渲染）：snow_plan_stage 的请求在会话内呈现为阶段卡片。
// 回答走通用 pending.answer：按钮回传选项标签，自由输入回传 custom。
import React,{useState} from 'react';
import {planQuestion} from './plan-question.js';
import {purchaseLabels} from './packages.ts';

const yuan=n=>n==null?'待确认':`¥${(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const Badge=({children,tone})=><span className={`snow-plan-badge${tone?` snow-plan-badge-${tone}`:''}`}>{children}</span>;
const stageTitles={confirm:'01 · 确认这次出行',estimate:'02 · 确认计算依据',results:'03 · 找到合适的搭配',discussion:'一起继续想',review:'已存方案 · 保存时快照',status:''};

export function PlanQuestionCard({pending,packages}) {
  const data=planQuestion(pending);
  if(!data)return null;
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const answer=async payload=>{if(busy)return;setBusy(true);setError('');try{await pending.answer({answers:[{id:data.callId,selected:payload.selected??[],...(payload.custom?{custom:payload.custom}:{})}]});}catch(e){setError(e.message);setBusy(false);}};
  const editable=(data.stage==='confirm'||data.stage==='estimate');
  // 卡内可编辑字段会走自由输入回传：把当前编辑快照序列化进 custom，selected 承载按钮动作。
  const Editable=editable?PlanEditableBody:null;
  return <article className="snow snow-plan-card" aria-label={stageTitles[data.stage]||'方案卡片'} data-plan-stage={data.stage}>
    <header><Badge>{stageTitles[data.stage]}</Badge>{data.notice?<h3>{data.notice.title}</h3>:data.stage==='review'&&data.plan?.title?<h3>{data.plan.title}</h3>:<h3>{data.questionText||'请确认'}</h3>}</header>
    {data.notice?.text&&<p>{data.notice.text}</p>}
    {data.notice?.actions?.map((action,i)=><footer key={i} className="snow-plan-actions"><button className={i===0?'primary':''} disabled={busy} onClick={()=>answer({selected:[action.label]})}>{action.label}</button></footer>)}
    {Editable&&<Editable data={data} packages={packages} busy={busy} error={error} onAnswer={answer}/>}
    {!Editable&&!data.notice?.actions&&<PlanOptionsBody data={data} busy={busy} error={error} onAnswer={answer}/>}
    {error&&!Editable&&<p role="alert">{error}</p>}
    <p className="snow-plan-muted"><small>也可以直接在输入框继续说明；未选择的按钮不会生效。</small></p>
  </article>;
}

// confirm/estimate：卡内表单可编辑，提交时把编辑值序列化进 custom。
function PlanEditableBody({data,packages,busy,error,onAnswer}) {
  const [values,setValues]=useState(()=>({start:String(data.input?.start??''),nights:String(data.input?.nights??''),budget:String(data.input?.budget??'')}));
  const [ids,setIds]=useState(()=>[...(data.ids??[])]);
  const [estimates,setEstimates]=useState(()=>(data.estimates??[]).map(e=>({...e,amount:e.amount!=null?String(e.amount):''})));
  const usable=(packages??[]).filter(p=>p.completeness==='complete');
  const recommended=usable.filter(p=>(data.ids??[]).includes(p.id));
  const rest=usable.filter(p=>!(data.ids??[]).includes(p.id));
  const submit=()=>onAnswer({custom:JSON.stringify({stage:data.stage,values,ids,estimates})});
  return <>
    {data.stage==='confirm'&&<>
      <div className="snow-plan-fields">
        <label>入住日期<input type="date" value={values.start} onChange={e=>setValues({...values,start:e.target.value})}/></label>
        <label>住宿晚数<input type="number" min="1" max="366" placeholder={data.suggestions?.nights?`建议 ${data.suggestions.nights} 晚`:'不限'} value={values.nights} onChange={e=>setValues({...values,nights:e.target.value})}/></label>
        <label>整趟总预算 / 元<input type="number" min="0" step="0.01" placeholder="不限" value={values.budget} onChange={e=>setValues({...values,budget:e.target.value})}/></label>
      </div>
      {(data.suggestions?.start||data.suggestions?.nights)&&<p className="snow-plan-note">{data.suggestions.start&&<Badge tone="suggest">建议日期 {data.suggestions.start}</Badge>}{data.suggestions.nights&&<Badge tone="suggest">建议 {data.suggestions.nights} 晚</Badge>}</p>}
      <section aria-label="参与搭配的套餐"><h4>参与搭配的套餐</h4>
        <p className="snow-plan-muted">已预勾推荐，可取消或加选；全不选则由助理挑选。</p>
        {recommended.map(p=><PlanPackageRow key={p.id} record={p} checked={ids.includes(p.id)} onToggle={()=>setIds(ids.includes(p.id)?ids.filter(x=>x!==p.id):[...ids,p.id])} recommended/>)}
        {rest.length>0&&<details><summary>更多套餐（{rest.length}）</summary>{rest.map(p=><PlanPackageRow key={p.id} record={p} checked={ids.includes(p.id)} onToggle={()=>setIds(ids.includes(p.id)?ids.filter(x=>x!==p.id):[...ids,p.id])}/>)}</details>}
        <details className="snow-plan-estimates"><summary>补充已知的交通与餐饮费用（可留空）</summary>
          {['交通','餐饮'].map(label=>{
            const known=estimates.find(e=>e.label===label);
            return <label key={label} className="snow-plan-estimate-field">{label} / 元<input type="number" min="0" step="0.01" value={known?.amount??''} onChange={e=>setEstimates(estimates.find(x=>x.label===label)?estimates.map(x=>x.label===label?{...x,amount:e.target.value}:x):[...estimates,{label,amount:e.target.value,basis:'用户提供'}])}/></label>;
          })}
        </details>
      </section>
    </>}
    {data.stage==='estimate'&&<>
      <p>{data.start??'（日期待定）'} 入住{data.suggested?.start&&<Badge tone="suggest">建议日期</Badge>}，住 {data.nights??'?'} 晚{data.suggested?.nights&&<Badge tone="suggest">建议晚数</Badge>}。</p>
      <div className="snow-plan-fields two">
        {(data.estimates??[]).map((e,i)=><label key={i} className="snow-plan-estimate-field">{e.label} / 元{e.basis==='用户提供'?'（已提供）':'（示例估算，可修改）'}<input type="number" min="0" step="0.01" value={estimates[i]?.amount??''} onChange={ev=>setEstimates(estimates.map((x,j)=>j===i?{...x,amount:ev.target.value}:x))}/></label>)}
      </div>
      {data.scope&&<p className="snow-plan-muted">{data.scope}</p>}
    </>}
    {error&&<p className="snow-plan-error" role="alert">{error}</p>}
    <footer className="snow-plan-actions"><button className="primary" disabled={busy} onClick={submit}>{busy?'正在处理…':data.stage==='confirm'?'生成方案':'接受这些条件并计算'}</button></footer>
  </>;
}

function PlanPackageRow({record:p,checked,onToggle,recommended}) {
  return <label className={`snow-plan-package${checked?' is-checked':''}`}>
    <input type="checkbox" checked={checked} onChange={onToggle}/>
    <span>{p.name} {recommended&&<Badge>推荐</Badge>}
      <small>{purchaseLabels[p.purchaseStatus]} · {p.nights??'晚数待确认'} 晚 · {p.splitAllowed===true?'可拆分':p.splitAllowed===false?'需连住':'拆分待确认'} · 资料完整</small>
    </span>
  </label>;
}

// results/discussion/review：展示只读，按钮承载快捷动作。
function PlanOptionsBody({data,busy,error,onAnswer}) {
  if(data.stage==='results')return <>
    {(data.results??[]).map((combo,index)=><article key={index} className={`snow snow-plan-result${(data.selected??[]).includes(index)?' is-selected':''}`}>
      <div className="snow-plan-result-head"><div><Badge>{index===0?'优先推荐':`备选 ${index+1}`}</Badge><h3>{combo.title||'候选搭配'}</h3><small>{combo.start??''}{combo.end?` → ${combo.end}`:''}{combo.nights!=null?` · ${combo.nights} 晚`:''}</small></div>
      <div className="snow-plan-money"><strong>{yuan(combo.total)}</strong><small>整趟预计总价{combo.estimated?' · 含已接受估算':''}</small></div></div>
      {combo.daily?.length>0&&<div className="table-scroll"><table aria-label={`候选 ${index+1} 每日费用`}><thead><tr><th>日期 / 安排</th><th>费用</th><th>依据</th></tr></thead><tbody>{combo.daily.map((row,i)=><tr key={i}><td>{row.date}{row.hotel&&<><br/>{row.hotel}</>}</td><td>{yuan(row.amount)}</td><td>{row.basis??''}</td></tr>)}</tbody></table></div>}
      {combo.sharedCosts?.map((cost,i)=><p key={i} className="snow-plan-shared"><b>{cost.label} {yuan(cost.amount)}</b>，单独计一次，不重复分到每天。{cost.basis&&` ${cost.basis}`}</p>)}
      {combo.allocation?.map((line,i)=><p key={i} className="snow-plan-muted">{line}</p>)}
      {combo.checks?.length>0&&<ul className="snow-plan-checks">{combo.checks.map((check,i)=><li key={i}>{check}</li>)}</ul>}
      {combo.reason&&<p className="snow-plan-reason">{combo.reason}</p>}
      <p className="snow-plan-pills"><span className="snow-plan-pill">本次已付成本 {yuan(combo.paid)}</span><span className="snow-plan-pill">预计待付 {yuan(combo.pending)}</span><span className="snow-plan-pill">{combo.budget==null?'未设预算':'预算内'}</span></p>
    </article>)}
    <footer className="snow-plan-bar">
      <span>已选择 {(data.selected??[]).length} 份</span>
      <button className="primary" disabled={busy} onClick={()=>onAnswer({selected:['继续讨论']})}>继续讨论</button>
      <button disabled={!(data.selected??[]).length||busy} onClick={()=>onAnswer({selected:['保存所选']})}>{busy?'正在保存…':`保存所选${(data.selected??[]).length?`（${(data.selected??[]).length}）`:''}`}</button>
    </footer>
  </>;
  if(data.stage==='discussion'){
    const chosen=(data.results??[]).filter((_,i)=>(data.selected??[]).includes(i));
    return <>
      {data.message&&<p>你的想法：{data.message}</p>}
      {chosen.length>1&&<div className="table-scroll"><table aria-label="方案比较"><thead><tr><th>搭配</th><th>整趟总价</th><th>换酒店</th><th>推荐理由</th></tr></thead><tbody>{chosen.map((c,i)=><tr key={i}><td>候选 {(data.selected??[])[i]+1}</td><td>{yuan(c.total)}</td><td>{c.switches??'—'}</td><td>{c.reason??''}</td></tr>)}</tbody></table></div>}
      {chosen.length===1&&<p className="snow-plan-muted">基于候选 {(data.selected??[])[0]+1} 讨论；重新计算与保存会检查套餐版本。</p>}
      {!chosen.length&&<p className="snow-plan-muted">不用先选方案。可以直接调整偏好，再确认条件生成新的搭配。</p>}
      <footer className="snow-plan-actions"><button disabled={busy} onClick={()=>onAnswer({selected:['调整预算或日期']})}>调整预算或日期</button></footer>
    </>;
  }
  if(data.stage==='review'){
    const plan=data.plan;
    return <>
      {plan&&<><p>{plan.start??''}{plan.nights!=null?` · ${plan.nights} 晚`:''} · {plan.packages?.length??0} 份套餐搭配</p>
        {plan.daily?.length>0&&<div className="table-scroll"><table><thead><tr><th>日期</th><th>费用</th><th>依据</th></tr></thead><tbody>{plan.daily.map((row,i)=><tr key={i}><td>{row.date}</td><td>{yuan(row.amount)}</td><td>{row.basis??''}</td></tr>)}</tbody></table></div>}
        <p className="snow-plan-pills"><span className="snow-plan-pill">整趟总价 {yuan(plan.total)}</span><span className="snow-plan-pill">已付 {yuan(plan.paid)}</span><span className="snow-plan-pill">待付 {yuan(plan.pending)}</span></p>
        {plan.reason&&<p className="snow-plan-reason">{plan.reason}</p>}
        {plan.unknowns?.length>0&&<p className="snow-plan-muted">未知项：{plan.unknowns.join('、')}</p>}
      </>}
      <p className="snow-plan-muted">回顾不自动读取新价格；继续调整后，计算与保存都会检查最新套餐。</p>
      <footer className="snow-plan-actions"><button className="primary" disabled={busy} onClick={()=>onAnswer({selected:['继续调整']})}>继续调整这份方案</button></footer>
    </>;
  }
  return <p className="snow-plan-muted">{data.questionText}</p>;
}
