import React, { createContext, useContext, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {date,evaluate,money,text} from './ledger.js';
import {PackageCard,PackageBenefits,usePackages,PlanSavedCard} from './package-cards.jsx';
import {packageStats,packageCandidates} from './package-explore.js';
import {fieldLabels,purchaseLabels} from './packages.ts';
import {storage} from './storage.js';
import {snowSessions, sessionTitle, groupSessions, packagesForSession, continuationPrompt} from './sessions.js';

const PackageSidebarContext=createContext(null);
export function PackageSidebarToggle() {
  const panel=useContext(PackageSidebarContext);
  if(!panel?.available)return null;
  return <span className="snow"><button className="icon-button snow-header-button" aria-label={panel.open?'收起套餐详情':'展开套餐详情'} title={panel.open?'收起套餐详情':'展开套餐详情'} aria-expanded={panel.open} aria-controls="snow-package-sidebar" onClick={panel.toggle}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/></svg></button></span>;
}
function PackageDrawer({children,onClose}) {
  const dialog=useRef(null);
  useEffect(()=>{dialog.current.showModal();},[]);
  return <dialog className="snow-package-drawer" ref={dialog} aria-label="套餐详情" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>{children}</dialog>;
}
function SessionRail({mobile,open,onClose,width,children}) {
  const dialog=useRef(null);
  useEffect(()=>{
    if(!mobile)return;
    if(open)dialog.current.showModal();else dialog.current.close();
  },[mobile,open]);
  if(!mobile)return <div className="snow snow-rail" style={{width}}>{children}</div>;
  return <dialog ref={dialog} className="snow snow-rail snow-mobile-rail" aria-label="雪季导航" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}}>
    <button className="snow-rail-close" aria-label="关闭菜单" onClick={onClose}><Icon name="close"/></button>{children}
  </dialog>;
}
function PackageFacts({record,fields}) {
  return <dl className="snow-detail-facts">{fields.map(key=>{
    const value=record[key];
    const shown=value===null?'待确认':Array.isArray(value)?(value.length?value.join('；'):'已确认无'):['quote','paid','paidExtra'].includes(key)?yuan(value/100):typeof value==='boolean'?(value?'是':'否'):String(value);
    return <div key={key}><dt>{fieldLabels[key]}</dt><dd className={value===null?'is-unknown':undefined}>{shown}</dd></div>;
  })}</dl>;
}
function PackageSidebar({records,plans=[],allPackages=records,onBack,missing=false,expanded=false,onAdd,onClose,error,loading,onRetry,width,onWidth}) {
  const [tab,setTab]=useState(plans.length?'plans':'packages'),[reference,setReference]=useState(null),[latest,setLatest]=useState(false);
  const activeTab=tab==='plans'?(plans.length?'plans':'packages'):(records.length?'packages':'plans');
  const categories=[['packages','套餐',records.length],['plans','方案',plans.length]].filter(([, ,count])=>count>0);
  const [recordMenu,setRecordMenu]=useState(null),[referenceNotice,setReferenceNotice]=useState(''),[referenceError,setReferenceError]=useState('');
  const menuButton=(record,kind)=>onAdd&&<button className="snow-record-menu-button" aria-label={`操作：${record.name??record.title}`} title="更多操作" aria-haspopup="menu" aria-expanded={recordMenu?.record.id===record.id&&recordMenu?.kind===kind} onClick={event=>{event.preventDefault();event.stopPropagation();setRecordMenu({record,kind,anchor:event.currentTarget});}}>···</button>;
  const currentPackage=reference&&allPackages.find(p=>p.id===reference.entry.id);
  const shown=reference?[latest&&currentPackage?currentPackage:reference.entry.snapshot]:activeTab==='packages'?records:[];
  const openReference=(entry,plan)=>{setReference({entry,plan});setLatest(false);};
  const PackageContainer=expanded?'article':'details',PackageHeading=expanded?'header':'summary';
  const DetailSection=expanded?'section':'details',DetailHeading=expanded?'h3':'summary';
  const panel=useRef(null),drag=useRef(null);
  const [maxWidth,setMaxWidth]=useState(600);
  useEffect(()=>{
    const layout=panel.current.parentElement;
    const measure=()=>setMaxWidth(Math.max(0,Math.min(600,layout.clientWidth-(window.innerWidth>1150?280:0))));
    const observer=new ResizeObserver(measure);observer.observe(layout);window.addEventListener('resize',measure);measure();
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[]);
  const minWidth=Math.min(280,maxWidth),shownWidth=Math.max(minWidth,Math.min(width,maxWidth));
  const resize=value=>onWidth(Math.max(minWidth,Math.min(value,maxWidth)));

  return <aside className="snow snow-package-sidebar" ref={panel} style={{width:shownWidth}} id="snow-package-sidebar" aria-label="关联详情" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();}}}>
    <div className="snow-package-resizer" role="separator" aria-label="调整套餐详情宽度" aria-orientation="vertical" aria-controls="snow-package-sidebar" aria-valuemin={minWidth} aria-valuemax={maxWidth} aria-valuenow={shownWidth} tabIndex={0}
      onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();drag.current={x:event.clientX,width:shownWidth};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{if(drag.current)resize(drag.current.width+drag.current.x-event.clientX);}}
      onPointerUp={event=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
      onKeyDown={event=>{const next={ArrowLeft:shownWidth+10,ArrowRight:shownWidth-10,Home:minWidth,End:maxWidth}[event.key];if(next!==undefined){event.preventDefault();resize(next);}}}
    />
    <div className="snow-package-sidebar-head"><h2>{reference||expanded?'套餐详情':'关联详情'}</h2><button className="icon-button snow-header-button" title="收起套餐详情" aria-label="收起套餐详情" onClick={onClose}><Icon name="close"/></button></div>
    <div className="snow-package-sidebar-body">{onBack&&<button className="snow-reference-back" onClick={onBack}>← 返回关联资料</button>}{error&&<p className="error" role="alert">详情刷新失败，以下为上次读取的内容。<button onClick={onRetry}>重试</button></p>}{loading&&<p role="status">正在刷新…</p>}{!expanded&&!reference&&categories.length>0&&<div className="snow-detail-tabs" aria-label="详情分类">{categories.map(([id,label,count])=>categories.length===1?<span className="snow-detail-category" key={id}>{label} <span className="snow-detail-count">{count}</span></span>:<button key={id} aria-pressed={activeTab===id} onClick={()=>setTab(id)}>{label} <span className="snow-detail-count">{count}</span></button>)}</div>}
    {reference&&<div className="snow-reference-nav">
      <button className="snow-reference-back" onClick={()=>{setReference(null);setTab('plans');}}><span aria-hidden="true">←</span>返回方案</button>
      <div className="snow-reference-meta"><p>{latest&&currentPackage?'最新资料':'方案保存时快照'} · 第 {(latest&&currentPackage?currentPackage:reference.entry.snapshot).revision} 版</p>
        {currentPackage&&(currentPackage.revision===reference.entry.revision?<span className="snow-reference-current"><Icon name="check" size={14}/>已是最新资料</span>:<button className="snow-reference-switch" onClick={()=>setLatest(value=>!value)}>{latest?'查看保存时快照':'查看最新资料'}<span aria-hidden="true">→</span></button>)}
      </div>
      {!currentPackage&&!loading&&!error&&<p className="snow-reference-missing">原套餐已删除，仍可查看保存时快照。</p>}
    </div>}
    {!reference&&activeTab==='plans'&&plans.map((plan,index)=><details className="snow-detail-package snow-detail-plan" key={plan.id} open={index===0?true:undefined}>
      <summary><span><strong>{plan.title}</strong><small className="snow-detail-meta"><span>{plan.start?`${plan.start} 入住`: '日期待确认'}{plan.nights!==null?` · ${plan.nights} 晚`:''}</span><span className="snow-session-tag">已保存</span></small></span>{menuButton(plan,'plan')}</summary>
      <PlanSavedCard block={{kind:'tool-result',meta:{version:1,status:'saved',plan}}} onPackage={openReference} hideTitle/>
    </details>)}
    {!reference&&!plans.length&&!records.length&&<p role="status">{missing?'该资料已删除或暂不可用。':'该会话暂无关联资料。'}</p>}
    {shown.map((record,index)=><PackageContainer className="snow-detail-package" key={record.id} open={!expanded&&index===0?true:undefined}>
      <PackageHeading><span><strong>{record.name}</strong><small className="snow-detail-meta"><span>{purchaseLabels[record.purchaseStatus]}</span><span className="snow-session-tag">{record.completeness==='incomplete'?'待补全':'资料完整'}</span></small></span>{menuButton(reference?(currentPackage??record):record,'package')}</PackageHeading>
      <div className="snow-package-detail">
        <div className="snow-detail-highlights"><div><span>报价</span><strong>{record.quote===null?'待确认':yuan(record.quote/100)}</strong></div><div><span>住宿间夜</span><strong>{record.nights??'待确认'}{record.nights!==null&&<small> 间夜</small>}</strong></div></div>
        <section><h3>住宿信息</h3><PackageFacts record={record} fields={['hotels','roomType','resort','region','description']}/></section>
        <PackageBenefits record={record}/>
        <section><h3>购买与使用</h3><PackageFacts record={record} fields={['purchasePlatform','paid','paidExtra','validFrom','validTo','usedNights','voided']}/></section>
        <DetailSection className="snow-detail-section"><DetailHeading>使用规则</DetailHeading><PackageFacts record={record} fields={['surchargeRules','unavailableDates']}/></DetailSection>
        {record.unknowns.length>0&&<DetailSection className="snow-detail-section snow-detail-pending"><DetailHeading>待补全 <span>{record.unknowns.length} 项</span></DetailHeading><ul>{record.unknowns.map((item,i)=><li key={i}>{item}</li>)}</ul></DetailSection>}
      </div>
    </PackageContainer>)}</div>
    {referenceNotice&&<p className="snow-reference-feedback" role="status">{referenceNotice}</p>}
    {referenceError&&<p className="snow-reference-feedback error" role="alert">{referenceError}</p>}
    {recordMenu&&<SessionMenu anchor={recordMenu.anchor} label="资料操作" compact onClose={()=>setRecordMenu(null)}><button role="menuitem" onClick={()=>{
      setReferenceError('');setReferenceNotice('');
      try{const added=onAdd(recordMenu.record,recordMenu.kind);setReferenceNotice(added?'已添加到当前会话输入框。':'输入框已包含这项资料。');}
      catch(error){setReferenceError(error.message);}
      finally{recordMenu.anchor.focus();setRecordMenu(null);}
    }}><span className="snow-menu-add" aria-hidden="true">＋</span>添加到会话</button></SessionMenu>}
  </aside>;
}

const yuan=n=>n==null?'待确认':new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY',maximumFractionDigits:2}).format(n);
const initial={start:'2026-12-04',nights:'',region:'全部目的地',query:'',purchaseStatuses:[],completeness:[]};
function Icon({name='mountain',size=20}) {
  const paths={edit:'m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z',fork:'M5 3v9a7 7 0 0 0 7 7h5M5 5h12M20 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0M21 19a2 2 0 1 1-4 0 2 2 0 0 1 4 0',archive:'M4 4h16v5H4zM5 9v11h14V9M9 13h6',mountain:'M2 19 9 5l4 8 3-5 6 11H2M6 11l3 2 3-2',search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',grid:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',compare:'M8 3v18M16 3v18M3 7h5M16 17h5M5 5l-2 2 2 2M19 15l2 2-2 2',book:'M4 3h13a3 3 0 0 1 3 3v15H6a2 2 0 0 1-2-2V3M4 17h16M8 7h8M8 11h6',upload:'M12 16V3M7 8l5-5 5 5M4 15v6h16v-6',pin:'M12 22s8-8 8-14a8 8 0 0 0-16 0c0 6 8 14 8 14M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',arrow:'M4 12h16M14 6l6 6-6 6',check:'M4 12l5 5L20 6',close:'M5 5l14 14M19 5 5 19',calendar:'M4 5h16v16H4zM4 10h16M8 2v6M16 2v6',save:'M5 3h14v19l-7-5-7 5V3',info:'M12 10v7M12 6v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0'};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]||paths.mountain}/></svg>;
}
function SessionMenu({anchor,onClose,children,label="会话操作",compact=false}) {
  const ref=useRef(null);
  useEffect(()=>{
    const menu=ref.current;
    const toggled=event=>{if(event.newState==='closed')onClose();};
    menu.addEventListener('toggle',toggled);
    menu.showPopover();
    const rect=anchor.getBoundingClientRect();
    const left=Math.max(8,Math.min(compact?rect.right-menu.offsetWidth:rect.left,window.innerWidth-menu.offsetWidth-8));
    const top=rect.bottom+6+menu.offsetHeight<=window.innerHeight-8?rect.bottom+6:Math.max(8,rect.top-menu.offsetHeight-6);
    menu.style.left=`${left}px`;menu.style.top=`${top}px`;
    menu.querySelector('button')?.focus();
    const close=()=>{menu.hidePopover();};
    window.addEventListener('resize',close);
    window.addEventListener('scroll',close,true);
    return()=>{menu.removeEventListener('toggle',toggled);window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};
  },[anchor,compact]);
  return <div ref={ref} popover="auto" className={`snow snow-session-menu${compact?' snow-record-menu':''}`} role="menu" aria-label={label} onKeyDown={event=>{
    const buttons=[...ref.current.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
      event.preventDefault();event.stopPropagation();
      buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();
    }else if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();ref.current.hidePopover();anchor.focus();
    }else if(event.key==='Tab'){ref.current.hidePopover();anchor.focus();}
  }}>{children}</div>;
}

function Modal({title,children,onClose,wide=false,dismissible=true}) {
  const ref=useRef(null);
  useEffect(()=>{ref.current.showModal();},[]);
  return <dialog ref={ref} className={`snow-modal snow ${wide?'wide':''}`} aria-label={title} onClose={onClose} onCancel={event=>{if(!dismissible)event.preventDefault();}} onClick={e=>{if(dismissible&&e.target===ref.current)ref.current.close();}}><div className="modal-head"><h2>{title}</h2><button aria-label="关闭" disabled={!dismissible} className="icon-button" onClick={()=>ref.current.close()}><Icon name="close"/></button></div><div className="modal-body">{children}</div></dialog>;
}
function PackageDropdown({label,summary,children}) {
  const id=useId(),popup=useRef(null),trigger=useRef(null);
  useEffect(()=>{
    const close=event=>{if(event.type==='resize'||!popup.current?.contains(event.target))popup.current?.hidePopover();};
    window.addEventListener('resize',close);window.addEventListener('scroll',close,true);
    return()=>{window.removeEventListener('resize',close);window.removeEventListener('scroll',close,true);};
  },[]);
  return <div className="field package-tag-filter"><label htmlFor={id+'-trigger'}>{label}</label>
    <button id={id+'-trigger'} ref={trigger} type="button" className="package-tag-trigger" aria-label={label+'：'+summary} popovertarget={id} onClick={event=>{
      event.preventDefault();const menu=popup.current;menu.togglePopover();
      if(!menu.matches(':popover-open'))return;
      const rect=trigger.current.getBoundingClientRect();
      menu.style.width=Math.min(Math.max(rect.width,220),window.innerWidth-16)+'px';
      menu.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-menu.offsetWidth-8))+'px';
      menu.style.top=(rect.bottom+6+menu.offsetHeight<=window.innerHeight-8?rect.bottom+6:Math.max(8,rect.top-menu.offsetHeight-6))+'px';
    }}><span>{summary}</span></button>
    <div id={id} ref={popup} popover="auto" className="snow package-tag-options" role="group" aria-label={label+'选项'} onKeyDown={event=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();popup.current.hidePopover();trigger.current.focus();}
    }}>{children(()=>{popup.current.hidePopover();trigger.current.focus();},id)}</div>
  </div>;
}

function PackageTagFilter({value:form,onChange}) {
  const selected=[...form.purchaseStatuses.map(status=>purchaseLabels[status]),...form.completeness.map(status=>status==='complete'?'资料完整':'待补全')];
  return <PackageDropdown label="套餐标签" summary={selected.join('、')||'全部标签'}>{()=>[['purchaseStatuses','购买状态',Object.entries(purchaseLabels)],['completeness','资料完整度',[['complete','资料完整'],['incomplete','待补全']]]].map(([key,label,options])=><div role="group" aria-label={label} key={key}>{options.map(([value,title])=><label key={value}><input type="checkbox" checked={form[key].includes(value)} onChange={e=>onChange({...form,[key]:e.target.checked?[...form[key],value]:form[key].filter(item=>item!==value)})}/>{title}</label>)}</div>)}</PackageDropdown>;
}
function PackageSelect({label,value,options,onChange}) {
  return <PackageDropdown label={label} summary={options.find(([key])=>key===value)?.[1]??value}>{(close,id)=><div role="radiogroup" aria-label={label}>{options.map(([key,title])=><label key={key}><input type="radio" name={id} value={key} checked={value===key} onChange={()=>onChange(key)} onClick={close}/>{title}</label>)}</div>}</PackageDropdown>;
}

function Field({label,children}){const id=useId();return <div className="field"><label htmlFor={id}>{label}</label>{React.cloneElement(children,{id})}</div>;}
function SessionFeedback({state}) {
  const snapshot=useSyncExternalStore(listener=>state.subscribe(listener),()=>state.getSnapshot());
  const error=snapshot.promptError?.error;
  if(!error)return null;
  return <p role="alert" className="error">{error.details?.reason==='MODEL_DOES_NOT_SUPPORT_IMAGES'?'当前模型不支持图片，请切换宿主已有兼容模型，或移除图片并补充文字。':`${snapshot.promptError.op==='stop'?'停止':'发送'}失败：${error.message}`}</p>;
}
function Mountain(){return <svg className="mountain-art" viewBox="0 0 660 260" fill="none" aria-hidden="true"><path d="M0 242 106 115 151 172 269 22 332 110 390 69 548 245" fill="#dfe9e8"/><path d="m84 260 185-238 41 104 47 27 76 107" fill="#91a9a5"/><path d="m171 146 98-124 41 104-32-17-26 28-18-14-31 37z" fill="#f8fbf9"/><path d="M267 260 390 69l126 153 53-90 91 128" fill="#becdc8"/><path d="m352 128 38-59 49 59-28-8-18 19-16-25z" fill="#f8fbf9"/><path d="M0 260 84 223l75 26 129-33 101 22 120-23 151 27v18" fill="#718e86"/><path d="m57 260 138-51 62 10 90-27 83 15 62-30" stroke="#e7f0e8" strokeWidth="2" strokeDasharray="5 6"/><circle cx="347" cy="192" r="6" fill="#e8a156" stroke="#fff" strokeWidth="3"/><circle cx="492" cy="177" r="5" fill="#e8a156" stroke="#fff" strokeWidth="3"/></svg>;}

function Detail({result,onClose}) {
  const p=result.pkg;
  return <Modal title={`${p.id} · ${p.hotel||p.name}`} onClose={onClose} wide><p>{p.name}</p><div className="detail-stats"><div><small>订单实付</small><strong>{yuan(p.paid)}</strong></div><div><small>已付额外补款</small><strong>{yuan(p.paidExtra)}</strong></div><div><small>本次入住</small><strong>{result.nights} 晚</strong></div></div><p><b>有效期原文：</b>{p.validity||'未提供'}</p><p><b>雪场原文：</b>{p.resort||'未提供'}</p><p><b>房型：</b>{p.room||'待确认'}</p><h3>逐晚补款依据</h3><p className="muted">{result.start} 入住，{result.end} 离店。离店当天不计住宿加价。{result.needsHotel?'以下加价仅为原表指定酒店示例，最终适用门店尚需确认。':''}</p><div className="table-scroll"><table><thead><tr><th>住宿日期</th><th>已识别加价</th><th>来源 / 缺失原因</th></tr></thead><tbody>{result.nightly.map(n=><tr key={n.day}><td>{n.day}</td><td>{yuan(n.amount)}</td><td>{n.source||n.reason}</td></tr>)}</tbody></table></div>{result.reasons.map(s=><p className="error" key={s}>{s}</p>)}<h3>原始详情与加价表</h3><p className="muted small">来源：{p.source}。仅按编号关联；原表的冲突、缺失和适用条件均保留。</p>{p.details.length?p.details.map(s=><details key={s.name}><summary>{s.name}</summary><div className="table-scroll"><table><tbody>{s.rows.map(r=><tr key={r.number}><th className="row-number">{r.number}</th>{r.cells.map((c,i)=><td key={i}>{text(c)}</td>)}</tr>)}</tbody></table></div></details>):<p>未找到按编号命名的详情表，当前仅有套餐主表记录。</p>}</Modal>;
}

function Comparison({results,filter,onClose}) {
  const [costs,setCosts]=useState({});
  const numbers=r=>{
    const c=costs[r.pkg.id]||{};
    return {supplement:money(c.supplement),transport:money(c.transport),other:money(c.other)};
  };
  return <Modal title="对比出行方案" onClose={onClose} wide><p className="muted">{filter.start} 出发 · 输入本次仍需支付的费用（整单 / 元）。原有已付款不重复计入新增支出。空白表示未知，填 0 才表示无需额外支出。</p><div className="comparison-grid" style={{'--count':results.length}}>{results.map(r=>{const p=r.pkg,c=costs[p.id]||{},n=numbers(r),complete=Object.values(n).every(v=>v!==null);return <section className="compare-card" key={p.id}><span className="eyebrow">套餐 {p.id} / {p.region}</span><h3>{p.hotel}</h3><p>{r.start} → {r.end} · {r.nights} 晚</p><p className="muted">原订单已付 {yuan(p.paidExtra===null?null:p.paid+p.paidExtra)}{p.split?'（含本次之外间夜）':''}</p><div className="notice small">台账补款{r.complete?'合计':'已知部分'} {yuan(r.known)}{r.needsHotel?' · 指定酒店示例':''}；需核对适用条件。</div>{[['supplement','本次房间补款'],['transport','往返交通'],['other','餐饮 / 雪票 / 其他']].map(([key,label])=><Field key={key} label={label+'（手动估算）'}><input type="number" min="0" step="0.01" placeholder="待确认" value={c[key]??''} onChange={e=>setCosts({...costs,[p.id]:{...c,[key]:e.target.value}})}/></Field>)}<div className="compare-total"><span>预计新增支出</span><strong>{complete?yuan(n.supplement+n.transport+n.other):'费用未完整'}</strong></div>{r.reasons.map(x=><p className="error small" key={x}>{x}</p>)}<p className="muted small">机酒实时库存未接入；手动金额不代表商家报价。</p></section>;})}</div><div className="modal-actions"><button onClick={onClose}>返回调整</button></div></Modal>;
}

export function App({useSessions, renderSlot, actions}) {
  const [railSize,setRailSize]=useState(()=>({width:window.innerWidth<=1150?260:320,viewport:window.innerWidth}));
  const [mobileMenuOpen,setMobileMenuOpen]=useState(false);
  const mobile=railSize.viewport<=760;
  const compactRail=mobile||railSize.width<=280;
  useEffect(()=>{setMobileMenuOpen(false);},[mobile]);
  const railMax=Math.max(145,Math.min(420,Math.floor(railSize.viewport/2)));
  const drag=useRef(null);
  const resizeRail=width=>setRailSize(size=>({...size,width:Math.max(145,Math.min(railMax,width))}));
  useEffect(()=>{
    const resize=()=>setRailSize(size=>({viewport:window.innerWidth,width:window.innerWidth<=760?size.width:Math.min(size.width,Math.max(145,Math.min(420,Math.floor(window.innerWidth/2))))}));
    window.addEventListener('resize',resize);
    return()=>window.removeEventListener('resize',resize);
  },[]);
  const sessions=useSessions(state=>state);
  const [sessionBusy,setSessionBusy]=useState(false),[sessionError,setSessionError]=useState('');
  const [imagePreview,setImagePreview]=useState(null);
  const [packageSidebarOpen,setPackageSidebarOpen]=useState(()=>!mobile);
  const [inspectedPackage,setInspectedPackage]=useState(null);
  const [clickedReference,setClickedReference]=useState(null);
  useEffect(()=>setClickedReference(null),[sessions.current]);
  const [packageSidebarWidth,setPackageSidebarWidth]=useState(340);
  const [packageDrawerWidth,setPackageDrawerWidth]=useState(560);
  const [pendingDelete,setPendingDelete]=useState(null),[deleteBusy,setDeleteBusy]=useState(false),[deleteError,setDeleteError]=useState('');
  const [pendingPlanDelete,setPendingPlanDelete]=useState(null),[unavailable,setUnavailable]=useState(null);
  const [pendingArchive,setPendingArchive]=useState(null),[sessionMenu,setSessionMenu]=useState(null);
  const workspaceState=useSyncExternalStore(actions.workspaceList.subscribe,actions.workspaceList.getSnapshot);
  const [pendingRename,setPendingRename]=useState(null),[renameError,setRenameError]=useState('');
  const rows=snowSessions(sessions).filter(row=>!workspaceState.archivedSessionIds.includes(row.id)),current=rows.find(row=>row.id===sessions.current);
  const planSessionVersion=rows.map(row=>`${row.id}:${row.updatedAt}:${row.running}`).join('|');
  const conversation=useRef(null),sessionList=useRef(null);
  const [sessionQuery,setSessionQuery]=useState('');
  const [collapsedGroups,setCollapsedGroups]=useState({});
  async function startSession() {
    setSessionError('');setSessionQuery('');setSessionBusy(true);setView('explore');
    try {await actions.create();setView('conversation');setMobileMenuOpen(false);}
    catch(error){setSessionError(error.message);}
    finally{setSessionBusy(false);}
  }

  const [hostSaved,setHostSaved]=useState([]),[plansError,setPlansError]=useState(''),[plansLoaded,setPlansLoaded]=useState(false),[plansRefresh,setPlansRefresh]=useState(0);
  const [ledger,setLedger]=useState(null),[loading,setLoading]=useState(true);
  const [filtersOpen,setFiltersOpen]=useState(false);
  const [view,setView]=useState(()=>actions.lastSession()?'conversation':'explore'),[form,setForm]=useState(initial),[filter,setFilter]=useState(initial),[selection,setSelection]=useState([]),[sort,setSort]=useState('nights');
  useEffect(()=>{let active=true;setPlansError('');actions.listPlans().then(rows=>{if(active){setHostSaved(rows.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));setPlansLoaded(true);}}).catch(e=>{if(active)setPlansError(e.message);});return()=>{active=false;};},[view,plansRefresh,planSessionVersion]);
  const [detail,setDetail]=useState(null),[comparing,setComparing]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[formError,setFormError]=useState('');
  useEffect(()=>{
    if(mobile)setPackageSidebarOpen(false);
  },[mobile,view,current?.id]);
  useEffect(()=>{
    if(view==='conversation')sessionList.current?.querySelector('[aria-current="page"]')?.scrollIntoView({block:'nearest'});
  },[view,current?.id]);
  useEffect(()=>{
    if(view==='conversation'&&current)return actions.restoreReferences?.(current.id);
  },[view,current?.id,actions]);
  useEffect(()=>{
    const root=conversation.current;if(!root)return;
    const decorate=()=>root.querySelectorAll('[data-composer-chip="snow-record"]').forEach(chip=>{
      chip.setAttribute('role','button');chip.tabIndex=0;chip.setAttribute('aria-label',`查看详情：${chip.textContent.replace(/^@/,'')}`);
    });
    const observer=new MutationObserver(decorate);observer.observe(root,{childList:true,subtree:true});decorate();
    return()=>observer.disconnect();
  },[view,current?.id]);
  const startInput=useRef(null);
  useEffect(()=>{
    if(view==='conversation'&&current) requestAnimationFrame(()=>conversation.current?.querySelector('[contenteditable="true"]')?.focus());
  },[view,current?.id]);
  useEffect(()=>{let active=true;storage('ledger').then(l=>{if(active)setLedger(l||null);}).catch(()=>{if(active)setError('无法读取本机资料，请检查浏览器是否允许站点存储后重试。');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  useEffect(()=>{
    if(!loading&&view==='conversation'&&!current)setView('explore');
  },[loading,view,current?.id]);
  async function archiveSession() {
    if(!pendingArchive||sessionBusy)return;
    const id=pendingArchive.id;
    setSessionBusy(true);setSessionError('');
    try {
      await actions.archive(id);setPendingArchive(null);
      if(view==='conversation'&&sessions.current===id)setView('explore');
    } catch(error){setSessionError('归档失败：'+error.message);}
    finally{setSessionBusy(false);}
  }
  const host=usePackages(actions,`${view}:${current?.updatedAt}:${current?.running}`);
  const sessionGroups=groupSessions(rows,sessionQuery,host.rows,hostSaved);
  const sessionPackages=packagesForSession(host.rows,current?.id);
  const sessionPlans=hostSaved.filter(plan=>plan.sessionId===current?.id);
  const panelPackages=clickedReference?host.rows.filter(row=>clickedReference.type==='package'&&row.id===clickedReference.id):sessionPackages;
  const panelPlans=clickedReference?hostSaved.filter(row=>clickedReference.type==='plan'&&row.id===clickedReference.id):sessionPlans;
  const openClickedReference=event=>{
    const sent=event.target.closest('[data-snow-reference-id]');
    const chip=event.target.closest('[data-composer-chip="snow-record"]');
    let ref=sent?{type:sent.dataset.snowReference,id:sent.dataset.snowReferenceId}:null;
    if(chip){
      const editor=chip.closest('[contenteditable="true"]');
      ref=actions.referenceAt(current.id,[...editor.querySelectorAll('[data-composer-chip]')].indexOf(chip));
    }
    if(!ref)return false;
    event.preventDefault();event.stopPropagation();setClickedReference(ref);setPackageSidebarOpen(true);return true;
  };
  const closeInspectedPackage=()=>{const id=inspectedPackage;setInspectedPackage(null);requestAnimationFrame(()=>document.querySelector(`[data-package-id="${id}"] .package-inspect`)?.focus());};
  const stats=packageStats(host.rows);
  const candidates=packageCandidates(host.rows,filter,sort);
  async function continueRecord(record,kind) {
    if(sessionBusy)return;
    setSessionBusy(true);setSessionError('');
    const prompt=continuationPrompt(record,kind);
    try {
      if(await actions.continueRecord(record,prompt)){setSessionQuery('');setPackageSidebarOpen(!mobile);setView('conversation');}
      else setUnavailable({prompt,record});
    }catch(e){setSessionError(e.message);}
    finally{setSessionBusy(false);}
  }
  const openPackage=record=>continueRecord(record,'package');
  const packages=ledger?.packages||[];
  const evaluated=useMemo(()=>packages.map(p=>evaluate(p,filter.start||initial.start,filter.nights?Number(filter.nights):null)),[ledger,filter]);
  const results=evaluated.filter(r=>(filter.region==='全部目的地'||r.pkg.region===filter.region)&&(!filter.query||(r.pkg.name+r.pkg.hotel+r.pkg.resort).toLowerCase().includes(filter.query.toLowerCase()))).sort((a,b)=>sort==='surcharge'?(a.amount??Infinity)-(b.amount??Infinity):sort==='nights'?b.pkg.nights-a.pkg.nights:a.pkg.id.localeCompare(b.pkg.id));
  const chosen=evaluated.filter(r=>selection.includes(r.pkg.id));
  async function loadFile(e){const f=e.target.files?.[0];e.target.value='';if(!f)return;setError('');setBusy(true);try{if(!/\.xlsx$/i.test(f.name))throw new Error('请选择 .xlsx 工作簿。');setRaw(await readWorkbook(await f.arrayBuffer(),f.name));}catch(err){setError('导入失败：'+err.message);}finally{setBusy(false);}}
  function toggle(id){if(selection.includes(id))setSelection(selection.filter(x=>x!==id));else if(selection.length<3)setSelection([...selection,id]);else setNotice('最多对比 3 个方案，请先移除一个。');}
  function search(e){e.preventDefault();if(form.start!==''&&!date(form.start)||form.nights!==''&&(!Number.isInteger(Number(form.nights))||Number(form.nights)<1||Number(form.nights)>366)){setFormError('请填写有效入住日期或留空，住宿晚数应为 1–366 晚。');startInput.current.focus();return;}setFormError('');setFilter({...form,query:form.query.trim()});setNotice('已按当前条件更新候选方案。');setFiltersOpen(false);}
  const tabs=[['explore','grid','已录套餐'],['saved','save','已存方案']];
  return <PackageSidebarContext.Provider value={{available:!!clickedReference||sessionPackages.length>0||sessionPlans.length>0,open:packageSidebarOpen,toggle:()=>setPackageSidebarOpen(open=>!open)}}><div className="snow-workbench">{mobile&&<header className="snow snow-mobile-topbar"><button aria-label="打开菜单" aria-expanded={mobileMenuOpen} aria-controls="snow-sidebar" onClick={()=>setMobileMenuOpen(true)}>☰ <span>菜单</span></button><span>雪季出行</span></header>}<SessionRail mobile={mobile} open={mobileMenuOpen} onClose={()=>{setMobileMenuOpen(false);setSessionMenu(null);}} width={railSize.width}><aside className="rail" id="snow-sidebar"><div className="brand"><div className="brand-mark"><Icon size={27}/></div><div><b>雪季出行</b><small>我的山野计划</small></div></div><div className="season-label">26 / 27 雪季</div><nav aria-label="工作台导航">{tabs.map(([id,icon,label])=><button key={id} className={view===id?'active':''} aria-current={view===id?'page':undefined} onClick={()=>{setView(id);setMobileMenuOpen(false);}}><Icon name={icon}/><span>{label}</span>{id==='explore'&&<em>{host.rows.length}</em>}{id==='saved'&&(hostSaved.length)>0&&<em>{hostSaved.length}</em>}</button>)}</nav>
    <section className="snow-session-controls" aria-label="助理会话">
      <button className="snow-session-new" disabled={sessionBusy} onClick={startSession}><span aria-hidden="true">＋</span>{sessionBusy?'正在准备…':'出发去山野'}</button>
      {sessionError&&<p className="error" role="alert">{sessionError}</p>}
      <div className="snow-session-search"><Icon name="search" size={14}/><input aria-label="搜索会话" placeholder="搜索会话标题" value={sessionQuery} onChange={event=>setSessionQuery(event.target.value)} onKeyDown={event=>{if(event.key==='Escape'&&sessionQuery){event.preventDefault();event.stopPropagation();setSessionQuery('');}}}/>{sessionQuery&&<button aria-label="清空会话搜索" onClick={()=>setSessionQuery('')}><Icon name="close" size={12}/></button>}</div>
      <div className="snow-session-list" aria-label="雪季会话列表" ref={sessionList}>
        {(host.error||plansError)?<div className="snow-session-empty" role="alert">会话分类加载失败<button onClick={()=>{host.retry();setPlansRefresh(n=>n+1);}}>重试</button></div>:host.loading&&!host.rows.length?<div className="snow-session-empty" role="status">正在加载会话分类…</div>:!sessionGroups.length?<div className="snow-session-empty"><p>{sessionQuery?'没有匹配的会话':'还没有会话'}</p><small>{sessionQuery?'换个关键词，或清空搜索。':'点击“出发去山野”，一起安排这次出行。'}</small></div>:sessionGroups.map(group=><section className="snow-session-group" key={group.label} aria-label={group.label}><h3><button className="snow-group-toggle" aria-expanded={!!sessionQuery.trim()||!collapsedGroups[group.label]} onClick={()=>setCollapsedGroups({...collapsedGroups,[group.label]:!collapsedGroups[group.label]})}><span aria-hidden="true">{!sessionQuery.trim()&&collapsedGroups[group.label]?'▸':'▾'}</span>{group.label}<span className="snow-group-count">{group.items.length}</span></button></h3>{(sessionQuery.trim()||!collapsedGroups[group.label])&&group.items.map(row=>{
          const title=sessionTitle(row),selected=view==='conversation'&&row.id===current?.id;
          return <div className={`snow-session-row${selected?' is-current':''}`} key={row.id} data-session-id={row.id}>
            <button className="snow-session-open" title={title} aria-current={selected?'page':undefined} disabled={sessionBusy} onClick={()=>{try{actions.open(row.id);if(mobile)setPackageSidebarOpen(false);setView('conversation');setMobileMenuOpen(false);setSessionError('');}catch(error){setSessionError(error.message);}}}>
              <span className="snow-session-heading"><strong>{title}</strong>{row.packageStatus&&!compactRail&&<span className="snow-session-tag">{row.packageStatus}</span>}</span><span className="snow-session-meta">{row.packageStatus&&compactRail&&<span className="snow-session-tag snow-session-compact-tag">{row.packageStatus}</span>}<span className={row.running?'is-running':!row.completed&&!row.blank?'snow-session-idle':''}>{row.running?'正在执行':row.completed?'已完成':row.blank?'尚未开始':'可继续'}</span>{!!row.updatedAt&&<time dateTime={new Date(row.updatedAt).toISOString()} title={new Date(row.updatedAt).toLocaleString('zh-CN')}>{new Date(row.updatedAt).toLocaleString('zh-CN',new Date(row.updatedAt).toDateString()!==new Date().toDateString()?{month:'numeric',day:'numeric'}:{hour:'2-digit',minute:'2-digit'})}</time>}</span>
            </button>
            <div className="snow-session-actions">
            <button aria-label={`会话操作：${title}`} title="会话操作" disabled={sessionBusy} aria-haspopup="menu" aria-expanded={sessionMenu?.row.id===row.id} onClick={event=>setSessionMenu({row,anchor:event.currentTarget})}>···</button></div>
          </div>;
        })}</section>)}
      </div>
    </section>
    <div className="rail-bottom"><div className="local-dot"/><span>数据保存在本机</span><button className="return" aria-label="返回 DSH" onClick={actions.close}>← 返回 DSH</button></div></aside>
    <div className="snow-rail-resizer" role="separator" aria-label="调整侧边栏宽度" aria-orientation="vertical" aria-controls="snow-sidebar" aria-valuemin={145} aria-valuemax={railMax} aria-valuenow={railSize.width} tabIndex={0}
      onPointerDown={event=>{if(event.button!==0)return;event.preventDefault();event.currentTarget.focus();drag.current={x:event.clientX,width:railSize.width};event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerMove={event=>{if(drag.current)resizeRail(drag.current.width+event.clientX-drag.current.x);}}
      onPointerUp={event=>{drag.current=null;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}
      onKeyDown={event=>{const next={ArrowLeft:railSize.width-10,ArrowRight:railSize.width+10,Home:145,End:railMax}[event.key];if(next!==undefined){event.preventDefault();resizeRail(next);}}}
    />
  {sessionMenu&&<SessionMenu anchor={sessionMenu.anchor} onClose={()=>setSessionMenu(null)}>
      <button role="menuitem" onClick={()=>{setRenameError('');setPendingRename({id:sessionMenu.row.id,title:sessionTitle(sessionMenu.row)});setSessionMenu(null);}}><Icon name="edit"/>重命名</button>
      <button role="menuitem" onClick={async()=>{const id=sessionMenu.row.id;setSessionMenu(null);setSessionBusy(true);setSessionError('');try{await actions.fork(id);setSessionQuery('');setView('conversation');setMobileMenuOpen(false);}catch(error){setSessionError('分叉失败：'+error.message);}finally{setSessionBusy(false);}}}><Icon name="fork"/>分叉会话</button>
      {!host.loading&&!host.error&&plansLoaded&&!plansError&&!host.rows.some(record=>record.sessionId===sessionMenu.row.id)&&!hostSaved.some(plan=>plan.sessionId===sessionMenu.row.id)&&<button role="menuitem" onClick={()=>{setSessionError('');setPendingArchive(sessionMenu.row);setSessionMenu(null);}}><Icon name="archive"/>归档会话</button>}
  </SessionMenu>}
  </SessionRail>
  <div className="snow snow-content" hidden={view==='conversation'&&!!current}><main className="workspace"><header className="topbar"><div><span className="crumb">我的雪季</span><span className="separator">/</span>{tabs.find(t=>t[0]===view)?.[2]}</div><button onClick={startSession} disabled={sessionBusy}><Icon name="edit"/>{sessionBusy?'正在准备…':'开始录入'}</button></header>
  <div className="page"><div aria-live="polite" className={`feedback ${notice?'visible':''}`}>{notice}</div>{error&&<div role="alert" className="notice error">{error}</div>}
  {view==='explore'&&<><section className="hero"><div className="hero-copy"><div className="eyebrow"><span className="green-dot"/> 雪季计划进行中</div><h1>下一站，<br/>去山里过冬。</h1><p>从已购套餐出发，找到时间和预算都合适的那一程。</p><div className="hero-tags"><span>套餐权益</span><span>逐晚补款</span><span>方案对比</span></div></div><Mountain/><div className="mountain-caption">这个雪季，把好时光留给山野。</div></section>
  <section className="stats" aria-label="台账概况"><div><span>已录入套餐</span><strong>{host.loading||host.error?'—':stats.count.toString().padStart(2,'0')}<small> 份</small></strong></div><div><span>已知住宿间夜</span><strong>{host.loading||host.error?'—':stats.nights}<small> 晚</small></strong>{stats.nightsUnknown>0&&<small>{stats.nightsUnknown} 份晚数待确认</small>}</div><div><span>已知实付与补款合计</span><strong>{host.loading||host.error?'—':yuan(stats.paid/100)}</strong>{stats.paidUnknown>0&&<small>{stats.paidUnknown} 份金额未完整，非最终总额</small>}</div><div><span>已知目的地区域</span><strong>{host.loading||host.error?'—':stats.regions.length}<small> 处</small></strong>{stats.regionsUnknown>0&&<small>{stats.regionsUnknown} 份地区待确认</small>}</div></section>
  <section className="search-panel">{mobile?<button className="snow-filter-toggle" aria-expanded={filtersOpen} aria-controls="snow-explore-filters" onClick={()=>setFiltersOpen(open=>!open)}><Icon name="search" size={17}/><span><strong>筛选出行</strong><small>{filter.start||'不限日期'} · {filter.nights?`${filter.nights} 晚`:'按套餐晚数'} · {filter.region}</small></span><span aria-hidden="true">{filtersOpen?'−':'＋'}</span></button>:<div className="section-head"><h2><Icon name="search"/> 找一程适合的出行</h2><span>先选日期，再看套餐怎么用</span></div>}<form id="snow-explore-filters" hidden={mobile&&!filtersOpen} noValidate onSubmit={search}><div className="filter-grid"><Field label="入住日期"><input ref={startInput} aria-invalid={!!formError} aria-describedby={formError?'snow-filter-error':undefined} type="date" value={form.start} onChange={e=>setForm({...form,start:e.target.value})}/></Field><PackageSelect label="住宿晚数" value={form.nights} options={[["","按各套餐晚数"],...[1,2,3,4,5,7,10,15].map(n=>[String(n),`${n} 晚`])]} onChange={nights=>setForm({...form,nights})}/><PackageSelect label="目的地区域" value={form.region} options={['全部目的地',...stats.regions].map(region=>[region,region])} onChange={region=>setForm({...form,region})}/><PackageTagFilter value={form} onChange={setForm}/><button className="primary search-button" type="submit"><Icon name="search"/> 查找方案</button></div><div className="filter-bottom"><div className="text-search"><Icon name="search" size={17}/><input aria-label="搜索套餐或酒店" placeholder="搜索酒店、套餐或雪场" value={form.query} onChange={e=>setForm({...form,query:e.target.value})}/>{form.query&&<button type="button" aria-label="清空搜索" onClick={e=>{setForm({...form,query:''});setFilter({...filter,query:''});e.currentTarget.previousElementSibling.focus();}}><Icon name="close" size={14}/></button>}</div><button type="button" onClick={()=>{setForm(initial);setFilter(initial);}}>重置筛选</button></div>{formError&&<p id="snow-filter-error" role="alert" className="error">{formError}</p>}</form></section>
  <div className="results-head"><div><h2>你的出行候选 <span>{host.loading||host.error?'—':candidates.length}</span></h2><p>{filter.start?`${filter.start} 入住`:'不限入住日期'} · 仅展示符合所选条件的套餐，不代表实时有房</p></div><PackageSelect label="排序" value={sort} options={[["nights","住宿晚数从多到少"],["paid","实付金额从低到高"]]} onChange={setSort}/></div>
  {host.error?<div className="empty" role="alert">读取套餐失败：{host.error}<button onClick={host.retry}>重试</button></div>:host.loading?<div className="empty" role="status">正在读取已录入套餐…</div>:!host.rows.length?<div className="empty"><Icon name="book" size={36}/><h3>先记下一份套餐</h3><p>粘贴套餐说明，和助理核对后保存。信息不全也可以先记下来。</p><button className="primary" onClick={startSession} disabled={sessionBusy}>{sessionBusy?'正在准备…':'开始录入'}</button></div>:!candidates.length?<div className="empty"><h3>没有符合筛选条件的套餐</h3><p>试试放宽日期、晚数、目的地、标签或搜索关键词。</p><button onClick={()=>{setForm(initial);setFilter(initial);}}>重置筛选</button></div>:<div className="cards package-candidates">{candidates.map(({record})=><div className="package-candidate" key={record.id}><PackageCard record={record} onInspect={record=>setInspectedPackage(record.id)} onOpen={openPackage} onDelete={record=>{setDeleteError('');const plans=hostSaved.filter(plan=>plan.packages.some(entry=>entry.id===record.id));setPendingDelete({record,plans,archive:!host.rows.some(p=>p.id!==record.id&&p.sessionId===record.sessionId)&&!hostSaved.some(p=>p.sessionId===record.sessionId&&!plans.some(plan=>plan.id===p.id))});}}/></div>)}</div>}{ledger&&<section aria-label="历史台账候选"><h2>历史 Excel 台账候选</h2><div className="cards">{results.map(r=>{const p=r.pkg;return <article key={p.id} className={`trip-card ${selection.includes(p.id)?'selected':''}`}><div className={`card-scenery scenery-${p.region}`}><Icon size={75}/><span className="destination"><Icon name="pin" size={14}/>{p.region}{p.regionInferred?' · 地区推断':''}</span><span className="package-id">套餐 {p.id}</span></div><div className="card-body"><div className="card-meta"><span>{p.status||'状态待确认'}</span><span>{p.split?'可拆分使用':'连住 / 拆分待确认'}</span></div><h3>{p.hotel||p.name}</h3><p className="package-name" title={p.name}>{p.name}</p><div className="stay"><Icon name="calendar" size={16}/>{r.start.slice(5)} — {r.end.slice(5)}<b>{r.nights} 晚</b></div><div className="cost-row"><div><small>台账房间补款{r.needsHotel?' · 示例':''}</small><strong>{r.complete?yuan(r.amount):'待核对'}{r.complete&&<em> / 本次</em>}</strong></div><button className="text-button" onClick={()=>setDetail(r)}>查看依据 <Icon name="arrow" size={15}/></button></div><p className="paid">原订单已付 {yuan(p.paidExtra===null?null:p.paid+p.paidExtra)}{p.split?' · 总间夜金额':''}</p><div className={`card-warning ${r.reasons.length?'blocked':''}`}><Icon name="info" size={14}/><span>{r.reasons[0]||(r.complete?(r.needsHotel?'加价仅为指定酒店示例，需确认门店':'加价已按晚展开，权益及库存仍需确认'):'年份、房型或部分日期加价待确认')}</span></div><div className="card-actions"><button onClick={()=>setDetail(r)}>套餐详情</button><button className={selection.includes(p.id)?'chosen':''} aria-pressed={selection.includes(p.id)} onClick={()=>toggle(p.id)}>{selection.includes(p.id)?<Icon name="check" size={16}/>:<Icon name="compare" size={16}/>} {selection.includes(p.id)?'已选对比':'加入对比'}</button></div></div></article>;})}</div></section>}</>}
  {view==='saved'&&<><section className="hero snow-saved-title" aria-label="已存方案概览"><div className="hero-copy"><h1>已存方案 <span>{hostSaved.length} 份</span></h1><p>回顾每一程的安排与花费。<br/>继续调整时，重新核对套餐与费用。</p></div><Mountain/></section>{plansError&&<p role="alert">{plansError}</p>}
    {hostSaved.map(plan=><section className="snow-saved-entry" key={plan.id}><PlanSavedCard block={{kind:'tool-result',meta:{version:1,status:'saved',plan}}}>
      <div className="package-actions"><button className="primary package-open" disabled={sessionBusy||deleteBusy} onClick={()=>continueRecord(plan,'plan')}>继续规划 <span aria-hidden="true">→</span></button><button className="package-delete" disabled={deleteBusy} onClick={()=>{setDeleteError('');setPendingPlanDelete(plan);}}>删除方案</button></div>
    </PlanSavedCard></section>)}
    {!hostSaved.length&&!plansError&&<div className="empty"><Icon name="save" size={36}/><h3>还没有保存的方案</h3><p>已录入套餐可在“已录套餐”中核对。</p><button onClick={()=>setView('explore')}>查看已录套餐</button></div>}</>}
  <footer className="page-footer"><span>雪季出行工作台</span><span>{ledger?'来源：'+ledger.fileName:'文字录入 · 核对后保存'}</span></footer></div>
  {selection.length>0&&view==='explore'&&<div className="compare-bar"><div><Icon name="compare"/><b>已选 {selection.length} / 3</b><span>{chosen.map(r=>r.pkg.hotel.split('（')[0]).join(' · ')}</span></div><button className="text-button" onClick={()=>setSelection([])}>清空</button><button className="primary" onClick={()=>setComparing(true)}>对比与规划 <Icon name="arrow" size={17}/></button></div>}</main></div>
  {view==='explore'&&inspectedPackage&&host.rows.some(record=>record.id===inspectedPackage)&&<PackageDrawer onClose={closeInspectedPackage}><PackageSidebar key={inspectedPackage} expanded records={host.rows.filter(record=>record.id===inspectedPackage)} width={packageDrawerWidth} onWidth={setPackageDrawerWidth} error={host.error} loading={host.loading} onRetry={host.retry} onClose={closeInspectedPackage}/></PackageDrawer>}
  {view==='conversation'&&current&&<main className="snow-session-main"><div className="snow">{actions.sessionState(current.id)&&<SessionFeedback state={actions.sessionState(current.id)}/>}</div><div className="snow-session-layout"><div className="snow-conversation" ref={conversation} onKeyDownCapture={event=>{
    if((event.key==='Enter'||event.key===' ')&&event.target.matches('[data-composer-chip="snow-record"]'))openClickedReference(event);
  }} onClickCapture={event=>{
    if(openClickedReference(event))return;
    // 宿主图片灯箱使用 body portal，会被工作台原生 dialog 遮挡；复用宿主图片 URL 在内层 dialog 预览。
    const image=event.target.closest('button')?.querySelector('img');
    if(image){event.preventDefault();event.stopPropagation();setImagePreview({src:image.currentSrc||image.src,alt:image.alt});}
  }}>{renderSlot('conversation',{})}</div>{packageSidebarOpen&&(clickedReference||sessionPackages.length>0||sessionPlans.length>0)&&<PackageSidebar key={current.id+(clickedReference?.type??'')+(clickedReference?.id??'')} onBack={clickedReference?()=>setClickedReference(null):undefined} missing={!!clickedReference} width={packageSidebarWidth} onWidth={setPackageSidebarWidth} onAdd={(record,kind)=>actions.addReference(current.id,record,kind)} records={panelPackages} plans={panelPlans} allPackages={host.rows} error={host.error||plansError} loading={host.loading} onRetry={()=>{host.retry();setPlansRefresh(n=>n+1);}} onClose={()=>setPackageSidebarOpen(false)}/>}</div></main>}
  {unavailable&&<Modal title="原会话不可用" dismissible={!sessionBusy} onClose={()=>setUnavailable(null)}><p>原会话已归档或不存在。可新建会话继续，原资料保留。</p>{sessionError&&<p role="alert">{sessionError}</p>}<div className="modal-actions"><button disabled={sessionBusy} onClick={()=>setUnavailable(null)}>取消</button><button className="primary" disabled={sessionBusy} onClick={async()=>{if(sessionBusy)return;setSessionBusy(true);setSessionError('');try{await actions.create(unavailable.prompt,unavailable.record);setUnavailable(null);setView('conversation');}catch(e){setSessionError(e.message);}finally{setSessionBusy(false);}}}>新建会话继续</button></div></Modal>}
  {imagePreview&&<Modal title="截图预览" onClose={()=>setImagePreview(null)} wide><img src={imagePreview.src} alt={imagePreview.alt} style={{display:'block',maxWidth:'100%',maxHeight:'70vh',margin:'auto'}}/></Modal>}
  {pendingPlanDelete&&<Modal title="删除方案" dismissible={!deleteBusy} onClose={()=>setPendingPlanDelete(null)}>
    <p>确定删除“{pendingPlanDelete.title}”吗？删除后无法恢复。</p>
    <p>{hostSaved.some(plan=>plan.id!==pendingPlanDelete.id&&plan.sessionId===pendingPlanDelete.sessionId)||host.rows.some(record=>record.sessionId===pendingPlanDelete.sessionId)?'该会话还关联其他套餐或方案，不会归档。':'删除后会自动归档关联会话。'}套餐和聊天记录保留。</p>
    {deleteError&&<p className="error" role="alert">{deleteError}</p>}
    <div className="modal-actions"><button autoFocus disabled={deleteBusy} onClick={()=>setPendingPlanDelete(null)}>取消</button><button disabled={deleteBusy} className="primary" onClick={async()=>{
      if(deleteBusy)return;setDeleteBusy(true);setDeleteError('');
      try{const message=await actions.deletePlan(pendingPlanDelete.id);setHostSaved(rows=>rows.filter(plan=>plan.id!==pendingPlanDelete.id));setPendingPlanDelete(null);setNotice(message||'方案已删除。');setPlansRefresh(n=>n+1);}
      catch(error){setDeleteError('删除失败：'+error.message);}
      finally{setDeleteBusy(false);}
    }}>{deleteBusy?'正在删除…':'确认删除'}</button></div>
  </Modal>}
  {pendingDelete&&<Modal title="删除套餐" dismissible={!deleteBusy} onClose={()=>setPendingDelete(null)}>
    <p>确定删除“{pendingDelete.record.name}”吗？删除后无法恢复。</p>
    {pendingDelete.plans.length>0&&<div><p>以下 {pendingDelete.plans.length} 份方案引用了此套餐，将一并永久删除（包括同时引用其他套餐的方案）：</p><ul>{pendingDelete.plans.map(plan=><li key={plan.id}>{plan.title}{plan.start?` · ${plan.start} 入住`:''}</li>)}</ul></div>}
    {pendingDelete.plans.length>0&&<p>{pendingDelete.archive?'这是该会话关联的最后一个套餐，删除后会同时归档会话。':'该会话还关联其他套餐或方案，不会归档。'}受影响方案的会话若不再关联任何资料，也会自动归档。聊天记录保留。</p>}
    {deleteError&&<p className="error" role="alert">{deleteError}</p>}
    <div className="modal-actions"><button autoFocus disabled={deleteBusy} onClick={()=>setPendingDelete(null)}>取消</button><button disabled={deleteBusy} className="primary" onClick={async()=>{
      if(deleteBusy)return;setDeleteBusy(true);setDeleteError('');
      try{setNotice(await actions.deletePackage(pendingDelete.record,pendingDelete.archive,pendingDelete.plans));setPendingDelete(null);}
      catch(error){setDeleteError(error.message);}
      finally{setDeleteBusy(false);host.retry();setPlansRefresh(n=>n+1);}
    }}>{deleteBusy?'正在删除…':'确认删除'}</button></div>
  </Modal>}
  {pendingRename&&<Modal title="编辑会话标题" dismissible={!sessionBusy} onClose={()=>setPendingRename(null)}>
    <form onSubmit={async event=>{
      event.preventDefault();if(sessionBusy)return;
      if(!pendingRename.title.trim()){setRenameError('请输入会话标题。');return;}
      setSessionBusy(true);setRenameError('');
      try{await actions.rename(pendingRename.id,pendingRename.title);setPendingRename(null);}
      catch(error){setRenameError('保存失败：'+error.message);}
      finally{setSessionBusy(false);}
    }}>
      <Field label="会话标题"><input autoFocus value={pendingRename.title} disabled={sessionBusy} onFocus={event=>event.target.select()} onChange={event=>{setPendingRename({...pendingRename,title:event.target.value});setRenameError('');}}/></Field>
      {renameError&&<p className="error" role="alert">{renameError}</p>}
      <div className="modal-actions"><button type="button" disabled={sessionBusy} onClick={()=>setPendingRename(null)}>取消</button><button type="submit" className="primary" disabled={sessionBusy}>{sessionBusy?'正在保存…':'保存标题'}</button></div>
    </form>
  </Modal>}

  {pendingArchive&&<Modal title="归档会话" dismissible={!sessionBusy} onClose={()=>setPendingArchive(null)}>
    <p>确定归档“{sessionTitle(pendingArchive)}”吗？</p>
    <p className="muted">归档后，会话将从列表中收起，聊天记录保留。正在执行的任务不受影响。</p>
    {sessionError&&<p className="error" role="alert">{sessionError}</p>}
    <div className="modal-actions"><button autoFocus disabled={sessionBusy} onClick={()=>setPendingArchive(null)}>取消</button><button className="primary" disabled={sessionBusy} onClick={archiveSession}>{sessionBusy?'正在归档…':'确认归档'}</button></div>
  </Modal>}
  {comparing&&<Comparison results={chosen} filter={filter} onClose={()=>setComparing(false)}/>}
  {detail&&<Detail result={detail} onClose={()=>setDetail(null)}/>}

  </div></PackageSidebarContext.Provider>;
}
