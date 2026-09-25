import {test} from 'node:test';
import assert from 'node:assert/strict';
import {addRecordReference,referenceSource} from '../src/references.js';
test('引用仅发送类型与 ID，保留草稿，多标签坐标正确，重复去重，输入忙时不写入',async()=>{
 const record={id:'11111111-1111-4111-8111-111111111111',name:'套餐名称',description:'不得发送的正文',revision:9};
 const state={draft:'已有草稿\n',draftRev:1,occurrences:[]};const inserts=[];
 const input={state:{getSnapshot:()=>state},insertReference:(ref,span)=>{
   assert.equal(span.start,state.draft.length-state.occurrences.reduce((n,o)=>n+o.length-1,0));
   assert.equal(span.end,span.start);assert.equal(span.draftRev,state.draftRev);inserts.push(ref);
   state.occurrences.push({...ref,length:ref.clipboardText.length});state.draft+=ref.clipboardText+' ';state.draftRev++;return true;
 }};
 assert.equal(addRecordReference(input,record,'package'),true);
 assert.equal(addRecordReference(input,record,'package'),false);
 assert.equal(addRecordReference(input,{...record,title:'方案'},'plan'),true);
 assert.equal(inserts.length,2);assert.ok(state.draft.startsWith('已有草稿\n'));
 assert.deepEqual(JSON.parse(await referenceSource.codec.serialize(inserts[0].ref)),{type:'package',id:record.id});
 assert.deepEqual(JSON.parse(await referenceSource.codec.serialize(inserts[1].ref)),{type:'plan',id:record.id});
 assert.throws(()=>addRecordReference(input,{id:'bad'},'package'));
 input.insertReference=()=>false;
 assert.throws(()=>addRecordReference(input,{...record,id:'22222222-2222-4222-8222-222222222222'},'package'),/稍后重试/);
 await assert.rejects(referenceSource.codec.serialize('{"type":"other","id":"bad"}'));
});

test('历史消息引用展示保持原文，支持混合套餐/方案，忽略非法和无关 JSON',async()=>{
 const {splitRecordReferences}=await import('../src/references.js');
 const packageRef='{"type":"package","id":"11111111-1111-4111-8111-111111111111"}';
 const planRef='{"id":"22222222-2222-4222-8222-222222222222", "type":"plan"}';
 const text=`比较 ${packageRef} 和 ${planRef}\n是什么房型`;
 const parts=splitRecordReferences(text);
 assert.deepEqual(parts.filter(p=>typeof p!=='string').map(p=>p.type),['package','plan']);
 assert.equal(parts.map(p=>typeof p==='string'?p:p.raw).join(''),text);
 for(const raw of ['{"type":"package","id":"bad"}','{"type":"other","id":"11111111-1111-4111-8111-111111111111"}',packageRef.replace('}',',"extra":true}'),'普通文字 {坏 JSON}'])assert.deepEqual(splitRecordReferences(raw),[raw]);
});

test('刷新草稿还原多个引用，跳过已有标签，异步期间编辑或离开不会覆盖',async()=>{
 const {restoreDraftReferences}=await import('../src/references.js');
 const a='{"type":"package","id":"11111111-1111-4111-8111-111111111111"}',b='{"type":"plan","id":"22222222-2222-4222-8222-222222222222"}';
 let state={draft:`比较 ${a} 和 ${b} 的价格`,draftRev:1,occurrences:[]},listener;
 const inserted=[];
 const input={state:{getSnapshot:()=>state,subscribe:fn=>{listener=fn;return()=>{listener=null;};}},insertReference:(ref,span)=>{
   assert.equal(span.draftRev,state.draftRev);
   const offset=span.start+state.occurrences.reduce((n,o)=>n+(o.offset<span.start?o.length-1:0),0);
   assert.equal(state.draft.slice(offset,offset+ref.clipboardText.length),ref.clipboardText);
   inserted.push(ref);state={...state,draftRev:state.draftRev+1,occurrences:[...state.occurrences,{...ref,offset,length:ref.clipboardText.length}]};listener?.();return true;
 }};
 const remote={getPackage:async()=>({ok:true,value:{name:'套餐甲'}}),getPlan:async()=>({ok:true,value:{title:'方案乙'}})};
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 let dispose=restoreDraftReferences(input,remote);await flush();
 assert.deepEqual(inserted.map(r=>r.label),['套餐：套餐甲','方案：方案乙']);assert.equal(state.draft,`比较 ${a} 和 ${b} 的价格`);dispose();
 dispose=restoreDraftReferences(input,remote);await flush();assert.equal(inserted.length,2);dispose();
 state={draft:a,draftRev:10,occurrences:[]};dispose=restoreDraftReferences(input,remote);state={...state,draft:'新输入',draftRev:11};await flush();assert.equal(inserted.length,2);dispose();
 state={draft:a,draftRev:12,occurrences:[]};dispose=restoreDraftReferences(input,remote);dispose();await flush();assert.equal(inserted.length,2);
 state={draft:'',draftRev:13,occurrences:[]};dispose=restoreDraftReferences(input,remote);state={...state,draft:a,draftRev:14};listener();await flush();assert.equal(inserted.length,3);dispose();
});

test('@ 菜单列出全部套餐和方案、按名称筛选、排除已选引用，只序列化类型与 ID',async()=>{
 const {recordReferenceSource}=await import('../src/references.js');
 const a={id:'11111111-1111-4111-8111-111111111111',name:'禾木套餐'},b={id:'22222222-2222-4222-8222-222222222222',title:'春节方案'};
 const remote={listPackages:async()=>({ok:true,value:[a]}),listPlans:async()=>({ok:true,value:[b]})};
 const state={occurrences:[]};const source=recordReferenceSource(remote,()=>({state:{getSnapshot:()=>state}}));
 const controller=new AbortController();const req={query:'',signal:controller.signal},session={sessionId:'session'};
 const all=await source.candidates(session,req);assert.deepEqual(all.map(row=>row.section),['套餐','方案']);
 assert.deepEqual((await source.candidates(session,{...req,query:'春节'})).map(row=>row.name),['春节方案']);
 const {insert}=source.onPick({candidate:all[0]});assert.equal(insert.label,'套餐：禾木套餐');assert.deepEqual(JSON.parse(await source.codec.serialize(insert.ref)),{type:'package',id:a.id});
 state.occurrences=[insert];assert.equal((await source.candidates(session,req)).length,1);
 controller.abort();assert.deepEqual(await source.candidates(session,req),[]);
 remote.listPlans=async()=>({ok:false,error:{message:'读取失败'}});
 await assert.rejects(source.candidates(session,{query:'',signal:new AbortController().signal}),/读取失败/);
});
