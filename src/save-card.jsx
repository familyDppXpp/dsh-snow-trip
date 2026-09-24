import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {fieldLabels,purchaseLabels,benefitBasisLabels,saveMetadata,savePreviewSchema,packageMetadata} from './packages.ts';

export function saveQuestion(pending) {
  const q=pending?.questions?.[0];
  if(pending?.questions?.length!==1||!q.id.startsWith('snow-commit-'))return null;
  try{const parsed=savePreviewSchema.safeParse(JSON.parse(q.detail));return parsed.success&&q.id==='snow-commit-'+parsed.data.callId?parsed.data:null;}catch{return null;}
}
import {PackageBenefits} from './package-cards.jsx';
const labels={...fieldLabels,pendingQuestions:'待确认问题'};
const unknown=(key,value)=>value==null||(key==='purchaseStatus'&&value==='unknown');
export const changedFields=(previous,preview)=>Object.keys(labels).filter(key=>JSON.stringify(previous[key])!==JSON.stringify(preview[key]));
function shown(key,value) {
  if(unknown(key,value))return '待确认';
  if(key.endsWith('Basis'))return benefitBasisLabels[value];
  if(key.endsWith('Included'))return value?'包含':'不包含';
  if(key==='splitAllowed')return value?'可拆分':'不可拆分';
  if(key==='purchaseStatus')return purchaseLabels[value];
  if(['quote','paid','paidExtra'].includes(key))return `${(value/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})} 元`;
  if(Array.isArray(value))return value.length?value.join('；'):'已确认无';
  if(typeof value==='boolean')return value?'是':'否';
  return String(value)+(['nights','usedNights'].includes(key)?' 间夜':'');
}
function PackageDetails({preview:p}) {
  const groups=[['套餐信息',['description','hotels','roomType','resort','region','nights']],['购买与使用',['purchasePlatform','purchaseStatus','quote','paid','paidExtra','usedNights','voided']],['使用规则',['validFrom','validTo','surchargeRules','unavailableDates']]];
  return <>{groups.map(([title,keys],index)=>{const known=keys.filter(key=>!unknown(key,p[key]));return <React.Fragment key={title}>{known.length>0&&<section><h4>{title}</h4><dl>{known.map(key=><div key={key}><dt>{labels[key]}</dt><dd>{shown(key,p[key])}</dd></div>)}</dl></section>}{index===0&&<PackageBenefits record={p}/>}</React.Fragment>;})}{p.unknowns.length>0&&<aside><strong>待补全</strong><p>{p.unknowns.join('、')}</p></aside>}</>;
}
export function SaveCard({item,pending}) {
  const live=saveQuestion(pending),card=useRef(null),snapshot=useRef(null),[busy,setBusy]=useState(false),[answerError,setAnswerError]=useState('');
  useEffect(()=>{if(live)card.current?.scrollIntoView({block:'end'});},[live?.callId]);
  if(live)snapshot.current=live;
  const result=saveMetadata(item.meta),legacy=packageMetadata(item.meta);
  const data=result??snapshot.current??(legacy?{preview:legacy,previous:null}:null);
  const status=item.error?'failed':result?.status??(legacy?'saved':item.done?'failed':busy?'saving':live?'confirm':'waiting');
  const previous=data?.previous,preview=data?.preview;
  const answer=async label=>{if(busy)return;setBusy(true);setAnswerError('');try{await pending.answer({answers:[{id:pending.questions[0].id,selected:[label]}]});}catch(e){setAnswerError(e.message);setBusy(false);}};
  return <article ref={card} className="snow-save-card" aria-label={previous?'套餐修改':'套餐保存'} data-save-state={status}>
    <header><span>{({confirm:previous?'确认修改':'确认新增',saving:'正在保存…',waiting:'正在准备…',saved:previous?'已更新':'已保存',adjusting:'未保存 · 继续调整',failed:'保存失败'})[status]}</span><h3>{preview?.name??'套餐'}</h3></header>
    <div className="snow-save-body">{preview&&(previous?<><dl className="snow-save-diff">{changedFields(previous,preview).map(key=><div key={key}><dt>{labels[key]}</dt><dd><span className="snow-save-old">{shown(key,previous[key])}</span><span aria-label="修改为"> → </span><strong>{shown(key,preview[key])}{unknown(key,preview[key])&&!unknown(key,previous[key])?'（清空）':''}</strong></dd></div>)}</dl><p className="snow-save-hint">{changedFields(previous,preview).length?'其余信息保持不变。':'本次没有字段变化。'}</p></>:<PackageDetails preview={preview}/>)}
    </div>
    {(item.error||answerError)&&<p role="alert">{item.error||answerError}</p>}
    {status==='failed'&&!item.error&&<p role="alert">未能完成保存，请重新查询后调整。</p>}
    {(status==='confirm'||status==='saving')&&<footer><button className="primary" disabled={busy} onClick={()=>answer('确认保存')}>{busy?'正在保存…':'确认保存'}</button><button disabled={busy} onClick={()=>answer('继续调整')}>继续调整</button></footer>}
    {status==='saved'&&<small>保存时快照</small>}
  </article>;
}
export function SaveCards({items,store,sessionId}) {
  const requests=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  return <div className="snow snow-save-cards">{(items??[]).map(item=><SaveCard key={item.callId} item={item} pending={[...requests.values()].find(p=>p.sessionId===sessionId&&saveQuestion(p)?.callId===item.callId)}/>)}</div>;
}
