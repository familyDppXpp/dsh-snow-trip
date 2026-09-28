// SNOW-06 方案问题卡（客户端渲染）：snow_plan_stage 的请求在会话内呈现为阶段卡片。
// 回答走通用 pending.answer：按钮回传选项标签，自由输入回传 custom。
import React,{useState,useId} from 'react';
import {planQuestion} from '../shared/plan-question.js';
import {toCents} from '../shared/plans.ts';
import {purchaseLabels} from '../shared/packages.ts';

const yuan=n=>n==null?'待确认':`¥${(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
// 只转换明确以分标注的金额，保留原始计算结果与依据。
const readableBasis=text=>String(text??'').replace(/(\d+(?:\.\d+)?)\s*分(?!摊|钟)/g,(_,value)=>yuan(Number(value)));
const Badge=({children,tone})=><span className={`snow-plan-badge${tone?` snow-plan-badge-${tone}`:''}`}>{children}</span>;
const stageTitles={confirm:'01 · 确认这次出行',estimate:'02 · 确认计算依据',results:'03 · 找到合适的搭配',discussion:'一起继续想',update:'确认更新方案',review:'已存方案 · 保存时快照',status:''};

export function PlanQuestionCard({pending,packages,snapshot,outcome}) {
  const data=snapshot??planQuestion(pending);
  const readOnly=!!snapshot;
  if(!data)return null;
  const [collapsed,setCollapsed]=useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const answer=async payload=>{if(busy||readOnly)return;setBusy(true);setError('');try{await pending.answer({answers:[{id:data.callId,selected:payload.selected??[],...(payload.custom?{custom:payload.custom}:{})}]});}catch(e){setError(e.message);setBusy(false);}};
  const cancel=<button className="snow-cancel-action" disabled={busy} onClick={()=>answer({selected:['取消本次操作']})}>取消本次操作</button>;
  const editable=(data.stage==='confirm'||data.stage==='estimate');
  // 卡内可编辑字段会走自由输入回传：把当前编辑快照序列化进 custom，selected 承载按钮动作。
  const Editable=editable?PlanEditableBody:null;
  const supplement=!readOnly&&(<details className="snow-plan-message"><summary>{data.stage==='results'?'讨论或调整方案？补充说明':'想调整条件？补充说明'}</summary><div className="snow-plan-message-body"><label>继续补充想法<textarea rows={3} placeholder={data.stage==='results'?'例如：比较两份方案的雪票费用，或把预算调低一些…':'例如：餐饮预算调低一些，暂不租赁雪具…'} value={message} disabled={busy} onChange={e=>setMessage(e.target.value)}/></label><button disabled={busy||!message.trim()} onClick={()=>answer({custom:message.trim()})}>发送补充</button><p>也可以直接在输入框继续说明；{['results','update'].includes(data.stage)?'发送补充不会保存方案。':'发送补充不会确认以上费用。'}</p></div></details>);
  return <article className="snow snow-plan-card" aria-label={stageTitles[data.stage]||'方案卡片'} data-plan-stage={data.stage} data-collapsed={collapsed?'true':undefined} data-planning={data.planning?'true':undefined} data-readonly={readOnly?'true':undefined}>
    {readOnly&&<div className="snow-result-outcome" role="status"><strong>{data.stage==='update'?updateOutcome(outcome):outcome?.action==='select'?'已选择方案 · 已进入更新确认':outcome?.action==='save'?`已提交保存 · 已选 ${data.selected?.length??0} 份 · 已保存 ${outcome.items?.filter(item=>item.status==='saved').length??0} 份`:outcome?.action==='cancel'?'已取消 · 未保存方案':'已提交补充 · 未保存方案'}</strong>{outcome?.error&&<p role="alert">{outcome.error}</p>}{outcome?.custom&&<p style={{whiteSpace:'pre-wrap'}}>你的补充：{outcome.custom}</p>}</div>}
    <header className="snow-plan-heading">{!readOnly&&data.stage==='results'&&<button className="snow-plan-context-toggle" onClick={event=>{
      const root=event.currentTarget.closest('.snow-workbench')??document;
      const records=[...root.querySelectorAll('.snow-confirmed-plan')].filter(el=>el.getClientRects().length);
      setCollapsed(!collapsed);
      if(!collapsed)requestAnimationFrame(()=>records.at(-1)?.scrollIntoView({block:'start'}));
    }}>{collapsed?'展开方案':'查看确认条件'}</button>}<Badge>{stageTitles[data.stage]}</Badge>{data.notice?<h3>{data.notice.title}</h3>:['review','update'].includes(data.stage)&&data.plan?.title?<h3>{data.plan.title}</h3>:<h3>{data.stage==='results'?`可选方案 · ${data.results?.length??0} 份`:data.stage==='estimate'?'确认共同费用':data.questionText||'请确认'}</h3>}{!readOnly&&data.stage==='results'&&<p className="snow-plan-intro">{data.updating?'选择一份方案，核对修改前后差异后更新。':'查看整趟成本与每日安排，勾选后保存；也可以先比较或调整。'}</p>}{data.stage==='estimate'&&<p className="snow-plan-intro">逐项核对金额与依据，可以直接修改后再确认。</p>}</header>
    {data.notice?.text&&<p>{data.notice.text}</p>}
    {!readOnly&&data.notice?.actions&&<footer className="snow-plan-actions">{cancel}{data.notice.actions.map((action,i)=><button key={i} className={i===0?'primary':''} disabled={busy} onClick={()=>answer({selected:[action.label]})}>{action.label}</button>)}</footer>}
    {Editable&&<Editable data={data} packages={packages??data.packages} busy={busy} error={error} onAnswer={answer} cancel={cancel} readOnly={readOnly}/>}
    {data.stage==='update'&&<PlanUpdateBody data={data} busy={busy} onAnswer={answer} cancel={cancel} readOnly={readOnly} outcome={outcome} supplement={supplement} error={error}/>}
    {!Editable&&data.stage!=='update'&&!data.notice?.actions&&<PlanOptionsBody data={data} busy={busy} error={error} onAnswer={answer} cancel={cancel} readOnly={readOnly}/>}
    {error&&!Editable&&data.stage!=='update'&&<p role="alert">{error}</p>}
    {data.stage!=='update'&&supplement}
  </article>;
}

function updateOutcome(outcome) {
 const action=outcome?.selected?.[0];
 if(outcome?.action==='update')return `已选择${action??'确认更新'} · ${outcome.status==='saved'?(action==='确认另存'?'已另存为新方案':'已更新'):'保存失败 · 原方案未改变'}`;
 if(outcome?.action==='adjust')return '已选择继续调整 · 未保存';
 return outcome?.action==='cancel'?'已取消 · 未保存':'已提交补充 · 未保存';
}
function PlanUpdateBody({data,busy,onAnswer,cancel,readOnly,outcome,supplement,error}) {
 const [asNew,setAsNew]=useState(false);
 const copy=readOnly?outcome?.selected?.[0]==='确认另存':asNew;
 const table=(rows,label)=><div className="table-scroll"><table aria-label={label}><thead><tr><th scope="col">修改项</th><th scope="col">修改前</th><th scope="col">修改后</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><th scope="row">{r.label}</th><td style={{whiteSpace:'pre-wrap'}}>{r.label==='方案名称'?r.before:readableBasis(r.before)}</td><td style={{whiteSpace:'pre-wrap'}}>{r.label==='方案名称'?r.after:readableBasis(r.after)}</td></tr>)}</tbody></table></div>;
 const details=(data.changes??[]).filter(r=>r.detail);
 const previous=data.previous?.tracking;
 const booking={confirmed:'已确认',unreserved:'未预约'},refund={refundable:'可退',nonrefundable:'不可退'};
 return <>
  <div className="snow-plan-update-body">
  {table([...(data.changes??[]).filter(r=>!r.detail),...(copy&&data.copyTitle&&data.copyTitle!==data.plan.title?[{label:'方案名称',before:data.plan.title,after:data.copyTitle}]:[])],'方案修改前后差异')}
  <p className="snow-plan-pills"><strong>{data.costChange}</strong></p>
  {details.length>0&&<details className="snow-plan-more"><summary>查看费用与说明变化明细</summary>{table(details,'费用与说明变化明细')}</details>}
  {!data.rename&&<details className="snow-plan-more"><summary>查看调整后的完整方案</summary><PlanOptionsBody data={{stage:'review',plan:data.plan}} readOnly/>{data.plan.conditions&&<p>房间数：{data.plan.conditions.rooms} · 人数：{data.plan.conditions.people??'未知'} · 滑雪天数：{data.plan.conditions.skiDays??'未知'}</p>}{data.plan.packages?.map(p=><p key={p.id}>{p.snapshot?.name} · {p.snapshot?.region} · {p.snapshot?.resort} · {p.snapshot?.hotels?.join('、')}</p>)}{data.plan.sharedCosts?.map((c,i)=><p key={i}>{c.label}：{yuan(c.amount)} · {readableBasis(c.basis)}</p>)}{data.plan.allocation?.map((line,i)=><p key={i}>{readableBasis(line)}</p>)}</details>}
  {!data.rename&&<aside className="snow-plan-note" aria-label="预约与退改信息处理">
   {copy?<><strong>另存为新方案</strong><p>原方案保留，新方案的预约、退改状态及策略均为未知。</p></>:data.resetTracking?<><strong>预约与退改信息将重置</strong><p>日期、人数、房间数或套餐搭配变化，需重新确认预约和退改条件。</p><p>{booking[previous?.booking]??'未知'} → 未知；{refund[previous?.refund]??'未知'} → 未知</p>{previous?.refundPolicy&&<p>原策略将清空：{previous.refundPolicy}</p>}</>:<><strong>预约与退改信息保留</strong><p>{booking[previous?.booking]??'预约状态未知'} · {refund[previous?.refund]??'退改状态未知'}{previous?.refundPolicy?` · ${previous.refundPolicy}`:''}</p></>}
  </aside>}
  </div>
  {!readOnly&&<div className="snow-plan-update-footer">
  {error&&<p role="alert">{error}</p>}
  <footer className="snow-plan-actions">{cancel}{!data.rename&&<button disabled={busy} onClick={()=>onAnswer({selected:['继续调整']})}>继续调整</button>}{!data.rename&&<button disabled={busy} onClick={()=>setAsNew(!asNew)}>{asNew?'改为更新原方案':'另存为新方案'}</button>}<button className="primary" disabled={busy} onClick={()=>onAnswer({selected:[asNew?'确认另存':'确认更新']})}>{busy?'正在保存…':asNew?'确认另存':'确认更新'}</button></footer>
  {supplement}
  </div>}
 </>;
}

// confirm/estimate：卡内表单可编辑，提交时把编辑值序列化进 custom。
function PlanEditableBody({data,packages,busy,error,onAnswer,cancel}) {
  const [values,setValues]=useState(()=>({start:String(data.input?.start??data.start??''),nights:String(data.input?.nights??data.nights??''),budget:String(data.input?.budget??''),...(data.planning?{rooms:String(data.input?.rooms??''),...(data.input?.people!==undefined?{people:String(data.input.people)}:{}),...(data.input?.skiDays!==undefined?{skiDays:String(data.input.skiDays)}:{})}:{})}));
  const [fees,setFees]=useState(()=>(data.fees??[]).map(f=>({...f,unitPrice:String(f.unitPrice/100),quantity:String(f.quantity)})));
  const [inputError,setInputError]=useState('');
  const [ids,setIds]=useState(()=>[...(data.ids??[])]);
  const [estimates,setEstimates]=useState(()=>(data.estimates??[]).map(e=>({...e,amount:e.amount!=null?String(e.amount/100):''})));
  const usable=(packages??[]).filter(p=>p.completeness==='complete');
  const selectedPackages=usable.filter(p=>ids.includes(p.id));
  const rest=usable.filter(p=>!ids.includes(p.id));
  const submit=()=>{try{
    if(data.planning){if(!values.start||!Number.isInteger(Number(values.nights))||Number(values.nights)<1||Number(values.nights)>366)throw new Error('请确认具体入住日期和住宿晚数');if(!Number.isInteger(Number(values.rooms))||Number(values.rooms)<1)throw new Error('请确认房间数');}
    const amounts=estimates.map(e=>{const amount=e.amount.trim();if(amount&&!/^\d+(\.\d{1,2})?$/.test(amount))throw new Error('费用请填写非负金额，最多两位小数');return {...e,amount:amount?toCents(Number(amount)):null};});
    setInputError('');onAnswer({selected:data.planning?['生成方案']:[],custom:JSON.stringify({stage:data.stage,values,ids,estimates:amounts,...(data.planning?{fees:fees.map(f=>{if(!f.unitPrice.trim()||!f.quantity.trim()||Number(f.quantity)<0)throw new Error('请填写费用单价和数量');return {...f,quantity:Number(f.quantity),unitPrice:toCents(Number(f.unitPrice))};})}:{}),amountUnit:'分'})});
  }catch(e){setInputError(e.message);}};
  return <>
    {data.stage==='confirm'&&<>
      <div className="snow-plan-fields">
        <label>入住日期<input type="date" disabled={busy} value={values.start} onChange={e=>setValues({...values,start:e.target.value})}/></label>
        <label>住宿晚数<input type="number" disabled={busy} min="1" max="366" placeholder={data.suggestions?.nights?`建议 ${data.suggestions.nights} 晚`:'不限'} value={values.nights} onChange={e=>setValues({...values,nights:e.target.value})}/></label>
        <label>整趟总预算 / 元<input type="number" disabled={busy} min="0" step="0.01" placeholder="不限" value={values.budget} onChange={e=>setValues({...values,budget:e.target.value})}/></label>
        {data.planning&&<label>房间数<input type="number" min="1" max="100" disabled={busy} value={values.rooms} onChange={e=>setValues({...values,rooms:e.target.value})}/></label>}
        {data.planning&&values.people!==undefined&&<label>出行人数<input type="number" min="1" disabled={busy} value={values.people} onChange={e=>setValues({...values,people:e.target.value})}/></label>}
        {data.planning&&values.skiDays!==undefined&&<label>滑雪天数<input type="number" min="0" disabled={busy} value={values.skiDays} onChange={e=>setValues({...values,skiDays:e.target.value})}/></label>}
      </div>
      {(data.suggestions?.start||data.suggestions?.nights)&&<p className="snow-plan-note">{data.suggestions.start&&<Badge tone="suggest">建议日期 {data.suggestions.start}</Badge>}{data.suggestions.nights&&<Badge tone="suggest">建议 {data.suggestions.nights} 晚</Badge>}</p>}
      {Array.isArray(data.suggestions)&&<ul className="snow-plan-note">{data.suggestions.map((text,i)=><li key={i}>{text}</li>)}</ul>}
      <section aria-label="参与搭配的套餐"><h4>参与搭配的套餐</h4>
        <p className="snow-plan-muted">可指定套餐范围；全不选则从全部资料完整的套餐中筛选。</p>
        {selectedPackages.map(p=><PlanPackageRow key={p.id} record={p} checked={ids.includes(p.id)} onToggle={()=>setIds(ids.includes(p.id)?ids.filter(x=>x!==p.id):[...ids,p.id])} recommended={(data.ids??[]).includes(p.id)}/>)}
        {rest.length>0&&<details className="snow-plan-more"><summary>更多套餐（{rest.length}）</summary>{rest.map(p=><PlanPackageRow key={p.id} record={p} checked={ids.includes(p.id)} onToggle={()=>setIds(ids.includes(p.id)?ids.filter(x=>x!==p.id):[...ids,p.id])}/>)}</details>}
        {!data.planning&&<details className="snow-plan-estimates"><summary>补充已知的交通与餐饮费用（可留空）</summary>
          {['交通','餐饮'].map(label=>{
            const known=estimates.find(e=>e.label===label);
            return <label key={label} className="snow-plan-estimate-field">{label} / 元<input type="number" min="0" step="0.01" value={known?.amount??''} onChange={e=>setEstimates(estimates.find(x=>x.label===label)?estimates.map(x=>x.label===label?{...x,amount:e.target.value}:x):[...estimates,{label,amount:e.target.value,basis:'用户提供'}])}/></label>;
          })}
        </details>}
      </section>
    </>}
    {data.planning&&<section aria-label="共同费用"><h4>共同费用</h4><p className="snow-plan-muted">核对需求数量与单价；套餐已包含的权益将在核算时按实际覆盖数量抵扣。</p>{fees.map((f,i)=><div className="snow-estimate-row snow-fee-row" key={f.id}><div className="snow-estimate-copy"><strong>{f.label}</strong><span className="snow-estimate-basis">{f.source==='estimate'?'待确认估算':'用户提供'} · {f.basis}</span></div><label>数量<input type="number" min="0" step="any" disabled={busy} value={f.quantity} onChange={e=>setFees(fees.map((x,j)=>j===i?{...x,quantity:e.target.value}:x))}/></label><label>单价 / 元<input type="number" min="0" step="0.01" disabled={busy} value={f.unitPrice} onChange={e=>setFees(fees.map((x,j)=>j===i?{...x,unitPrice:e.target.value}:x))}/></label></div>)}</section>}
    {data.stage==='estimate'&&<div className="snow-estimate-body">
      <p className="snow-estimate-trip"><span>{data.start??'日期待定'} 入住{data.suggested?.start&&<Badge tone="suggest">建议日期</Badge>}</span><span>{data.nights??'?'} 晚{data.suggested?.nights&&<Badge tone="suggest">建议晚数</Badge>}</span><span>金额 / 元</span></p>
      <div className="snow-estimate-list">
        {(data.estimates??[]).map((e,i)=><label key={i} className="snow-estimate-row">
          <span className="snow-estimate-copy"><span className="snow-estimate-name">{e.label}<small>{e.basis==='用户提供'?'已提供':'待确认估算'}</small></span>{e.basis&&<span className="snow-estimate-basis">{e.basis}</span>}</span>
          <span className="snow-estimate-amount"><span aria-hidden="true">¥</span><input aria-label={`${e.label} / 元`} type="number" min="0" step="0.01" inputMode="decimal" disabled={busy} placeholder="待确认" value={estimates[i]?.amount??''} onChange={ev=>setEstimates(estimates.map((x,j)=>j===i?{...x,amount:ev.target.value}:x))}/></span>
        </label>)}
      </div>
      {data.scope&&<div className="snow-estimate-scope"><strong>费用范围</strong><p>{data.scope}</p></div>}
    </div>}
    {(inputError||error)&&<p className="snow-plan-error" role="alert">{inputError||error}</p>}
    <footer className="snow-plan-actions snow-plan-submit">{data.stage==='estimate'&&<span>估算可修改，确认后才用于核算</span>}{cancel}<button className="primary" disabled={busy} onClick={submit}>{busy?'正在处理…':data.stage==='confirm'?'生成方案':'接受这些条件并计算'}</button></footer>
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
function PlanOptionsBody({data,busy,error,onAnswer,cancel,readOnly=false}) {
  const [selected,setSelected]=useState(()=>data.selected??[]);
  const [active,setActive]=useState(0);
  const tabsId=useId();
  const respond=action=>onAnswer({selected:[action],custom:JSON.stringify({stage:data.stage,selected})});
  if(data.stage==='results')return <>
    {data.comparisonComplete===false&&<p className="snow-plan-note">尚未完成全部比较；以下方案已通过核算，可查看或保存。</p>}
    <div className="snow-result-tabs" role="tablist" aria-label="候选方案">{(data.results??[]).map((combo,index)=><button key={index} type="button" role="tab" id={`${tabsId}-tab-${index}`} aria-controls={`${tabsId}-panel-${index}`} aria-selected={active===index} tabIndex={active===index?0:-1} onClick={()=>setActive(index)} onKeyDown={event=>{
      const count=data.results.length;
      const next=event.key==='ArrowRight'?(index+1)%count:event.key==='ArrowLeft'?(index+count-1)%count:event.key==='Home'?0:event.key==='End'?count-1:null;
      if(next!==null){event.preventDefault();setActive(next);event.currentTarget.parentElement.children[next].focus();}
    }}>{combo.title||`方案 ${index+1}`}{selected.includes(index)&&<span aria-label="已选择"> ✓</span>}</button>)}</div>
    <div className="snow-result-panels">{(data.results??[]).map((combo,index)=><article key={index} role="tabpanel" id={`${tabsId}-panel-${index}`} aria-labelledby={`${tabsId}-tab-${index}`} hidden={active!==index} tabIndex={0} className={`snow snow-plan-result${selected.includes(index)?' is-selected':''}`}>
      {readOnly&&<span className="snow-result-select">{selected.includes(index)?'✓ 已选择':'未选择'}</span>}
      {!readOnly&&<label className="snow-result-select"><input type={data.updating?'radio':'checkbox'} name={data.updating?tabsId:undefined} aria-label={`选择方案 ${index+1}`} checked={selected.includes(index)} disabled={busy} onChange={()=>setSelected(data.updating?[index]:selected.includes(index)?selected.filter(i=>i!==index):[...selected,index])}/><span>{selected.includes(index)?'已选择':'选择此方案'}</span></label>}
      <div className="snow-plan-result-head"><div><Badge>{index===0?'优先推荐':`备选 ${index+1}`}</Badge><h3>{combo.title||'候选搭配'}</h3><small>{combo.start??''}{combo.end?` → ${combo.end}`:''}{combo.nights!=null?` · ${combo.nights} 晚`:''}</small></div>
      <div className="snow-plan-money"><strong>{yuan(combo.total)}</strong><small>整趟总成本{combo.estimated?' · 含已确认估算':''}</small></div></div>
      {combo.reason&&<p className="snow-plan-reason">{readableBasis(combo.reason)}</p>}
      {combo.daily?.length>0&&<div className="table-scroll snow-result-daily"><table aria-label={`候选 ${index+1} 每日费用`}><thead><tr><th scope="col">日期 / 住宿</th><th scope="col">当晚费用</th><th scope="col">计算依据</th></tr></thead><tbody>{combo.daily.map((row,i)=><tr key={i}><td>{row.date}{row.hotel&&<><br/>{row.hotel}</>}</td><td>{yuan(row.amount)}</td><td>{readableBasis(row.basis)}</td></tr>)}</tbody></table></div>}
      {combo.sharedCosts?.map((cost,i)=><p key={i} className="snow-plan-shared"><b>{cost.label} {yuan(cost.amount)}</b> <span className="snow-plan-muted">整趟计一次</span>{cost.basis&&<span className="snow-shared-basis">{combo.resultId?readableBasis(cost.basis).replace(/待确认/g,'已确认'):readableBasis(cost.basis)}</span>}</p>)}
      {combo.allocation?.map((line,i)=><p key={i} className="snow-plan-muted snow-result-allocation">{readableBasis(line)}</p>)}
      {combo.resultId&&<p className="snow-result-verified">行程与费用已核对</p>}
      <p className="snow-plan-pills"><span className="snow-plan-pill">{combo.budget==null?'未设预算':combo.total==null?'预算待核对':combo.total>combo.budget?'超出预算':`预算内 · 余 ${yuan(combo.budget-combo.total)}`}</span></p>
    </article>)}</div>
    {!readOnly&&<footer className="snow-plan-bar">
      <span aria-live="polite">{selected.length?`已选择 ${selected.length} 份`:data.updating?'选择一份方案后核对差异':'勾选方案后可保存'}</span>
      {cancel}<button className="primary" disabled={!selected.length||busy} onClick={()=>respond('保存所选')}>{busy?'正在处理…':data.updating?'核对更新差异':`保存所选${selected.length?`（${selected.length}）`:''}`}</button>
    </footer>}
  </>;
  if(data.stage==='discussion'){
    const chosen=(data.results??[]).filter((_,i)=>(data.selected??[]).includes(i));
    return <>
      {data.message&&<p>你的想法：{data.message}</p>}
      {chosen.length>1&&<div className="table-scroll"><table aria-label="方案比较"><thead><tr><th>搭配</th><th>整趟总价</th><th>换酒店</th><th>推荐理由</th></tr></thead><tbody>{chosen.map((c,i)=><tr key={i}><td>候选 {(data.selected??[])[i]+1}</td><td>{yuan(c.total)}</td><td>{c.switches??'—'}</td><td>{c.reason??''}</td></tr>)}</tbody></table></div>}
      {chosen.length===1&&<p className="snow-plan-muted">基于候选 {(data.selected??[])[0]+1} 讨论；重新计算与保存会检查套餐版本。</p>}
      {!chosen.length&&<p className="snow-plan-muted">不用先选方案。可以直接调整偏好，再确认条件生成新的搭配。</p>}
      {!readOnly&&<footer className="snow-plan-actions">{cancel}<button disabled={busy} onClick={()=>onAnswer({selected:['调整预算或日期']})}>调整预算或日期</button></footer>}
    </>;
  }
  if(data.stage==='review'){
    const plan=data.plan;
    return <>
      {plan&&<>{plan.costVersion!==2&&<p className="snow-plan-note">旧补款核算口径 · 保留当时金额，重新出行前请重新核算。</p>}<p>{plan.start??''}{plan.nights!=null?` · ${plan.nights} 晚`:''} · {plan.packages?.length??0} 份套餐搭配</p>
        {plan.daily?.length>0&&<div className="table-scroll"><table><thead><tr><th>日期</th><th>费用</th><th>依据</th></tr></thead><tbody>{plan.daily.map((row,i)=><tr key={i}><td>{row.date}</td><td>{yuan(row.amount)}</td><td>{readableBasis(row.basis)}</td></tr>)}</tbody></table></div>}
        <p className="snow-plan-pills"><span className="snow-plan-pill">整趟总价 {yuan(plan.total)}</span></p>
        {plan.reason&&<p className="snow-plan-reason">{plan.reason}</p>}
        {plan.unknowns?.length>0&&<p className="snow-plan-muted">未知项：{plan.unknowns.join('、')}</p>}
      </>}
      <p className="snow-plan-muted">回顾不自动读取新价格；继续调整后，计算与保存都会检查最新套餐。</p>
      {!readOnly&&<footer className="snow-plan-actions">{cancel}<button className="primary" disabled={busy} onClick={()=>onAnswer({selected:['继续调整']})}>继续调整这份方案</button></footer>}
    </>;
  }
  return <><p className="snow-plan-muted">{data.questionText}</p><footer className="snow-plan-actions">{cancel}</footer></>;
}

// 校验失败发生在 pending 创建之前，不能被工具视图的正常隐藏逻辑吞掉。
export function PlanStageFailure({block}) {
  if(!block?.isError)return null;
  const message=(block.content??[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
  return <article className="snow snow-plan-card" role="alert"><h3>方案卡片未生成</h3><p>{message||'卡片数据校验失败，请修正后重新生成。'}</p></article>;
}
