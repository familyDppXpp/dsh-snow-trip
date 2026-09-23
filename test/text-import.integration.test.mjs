import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,rename,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Context} from '@deepseek-ai/cordis';
import {createScope,bindScopeParent} from '@deepseek-ai/dsh-scope';
import * as SnowTools from 'dsh-snow-trip/tools';
import {TYPERT} from '../lib/typert.host.js';
import Tools from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Storage from '@deepseek-ai/dsh-storage';
import * as StorageJson from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import {SnowTrip} from '../lib/service.js';
import {packageMetadata} from '../src/packages.ts';

test('公开工具：确认→写入→重开→查询；拒绝、伪造、变更、取消和写盘失败无成功 metadata',async()=>{
  const root=await mkdtemp(join(tmpdir(),'snow-import-'));
  let ctx,owner,presetScope,secondAgent,calls=0,respond=()=>({answers:[{id:'save-package',selected:['确认保存']}]});
  let question;
  const archived=[];
  let onArchive=async()=>{};
  async function boot(){
    const rootContext=new Context();
    owner=rootContext.plugin({async apply(scope){ctx=scope;
    await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);
    await ctx.plugin(Storage);await ctx.plugin(StorageJson,{root});await ctx.plugin(StorageDomain,{backend:'json'});
    ctx.provide('userQuestions',{ask:async request=>{calls++;question=request.questions[0].detail;return respond();}});
    ctx.provide('workspaceRegistry',{archiveSession:async id=>{await onArchive();archived.push(id);}});
    await ctx.plugin(SnowTrip);
    }});await owner;ctx=rootContext;
    assert.equal(ctx.tools.schemas().some(tool=>tool.name.startsWith('snow_')),false,'宿主层不应注册雪季工具');
    agent={...agent};secondAgent={...agent,id:'second-session'};
    await ctx.snowTrip.listPackages();
    const presetKey={};
    await ctx.plugin({inject:['snowTrip','tools','userQuestions'],async apply(inner){
      presetScope=createScope(inner,presetKey);
      await presetScope.ctx.plugin(SnowTools);
    }});
    bindScopeParent(agent,presetKey);bindScopeParent(secondAgent,presetKey);
    assert.deepEqual(ctx.tools.schemas(agent).map(t=>t.name).sort(),['snow_query','snow_draft','snow_draft_get','snow_draft_discard','snow_set_basic','snow_set_purchase','snow_set_usage','snow_hotel','snow_surcharge','snow_unavailable_date','snow_pending_question','snow_clear_field','snow_commit'].sort());
    assert.deepEqual(ctx.tools.schemas(secondAgent).map(t=>t.name).sort(),['snow_query','snow_draft','snow_draft_get','snow_draft_discard','snow_set_basic','snow_set_purchase','snow_set_usage','snow_hotel','snow_surcharge','snow_unavailable_date','snow_pending_question','snow_clear_field','snow_commit'].sort());
    assert.deepEqual(ctx.tools.schemas({id:'ordinary-session'}),[]);
    assert.deepEqual(ctx.tools.schemas(),[]);
    const denied=await ctx.tools.execute({name:'snow_query',arguments:{},agent:{id:'ordinary-session'},signal:new AbortController().signal,callId:'denied'});
    assert.equal(denied.isError,true);
    return ctx.snowTrip.listPackages();
  }
  let agent={id:'test-session'};
  const execute=(name,args,signal=new AbortController().signal)=>ctx.tools.execute({name,arguments:args,agent,signal,callId:`call-${Math.random()}`});
  const ok=async(name,args)=>{const r=await execute(name,args);assert.equal(r.isError,false,JSON.stringify(r));return r;};
  try{
    assert.deepEqual(await boot(),[]);
    assert.ok(!ctx.tools.schemas(agent).some(t=>t.name==='snow_save_packages'));
    const {draftId}= (await ok('snow_draft',{})).value;
    assert.equal((await ok('snow_draft',{})).value.draftId,draftId,'重试创建不丢失草稿');
    await ok('snow_set_basic',{draftId,description:'长白山住宿'});
    await ok('snow_set_purchase',{draftId,quote:1299.50,purchaseStatus:'unpurchased'});
    await ok('snow_set_usage',{draftId,nights:3});
    await ok('snow_hotel',{draftId,action:'add',value:'长白山酒店'});
    await ok('snow_hotel',{draftId,action:'add',value:'长白山酒店'});
    await ok('snow_unavailable_date',{draftId,action:'none'});
    const draft=(await ok('snow_draft_get',{draftId})).value;
    assert.deepEqual(draft.package.hotels,['长白山酒店']);assert.equal(draft.package.quote,1299.5);
    for(const [name,args] of [
      ['snow_set_usage',{draftId,nights:'3'}],['snow_set_purchase',{draftId,quote:1.005}],
      ['snow_hotel',{draftId,action:'add',value:[['酒店']]}],['snow_set_basic',{draftId,source:'test'}],
      ['snow_unavailable_date',{draftId,action:'add',value:'2026-02-30'}],
      ['snow_hotel',{draftId,action:'remove',value:'不存在'}],
    ]){const r=await execute(name,args);assert.equal(r.isError,true,JSON.stringify(r));assert.equal(r.meta,undefined);}
    const errorText=r=>r.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');
    assert.match(errorText(await execute('snow_set_purchase',{draftId,paid:1.005})),/paid.*1.005/);
    assert.match(errorText(await execute('snow_set_usage',{draftId,nights:'3'})),/nights.*integer.*3/);
    assert.match(errorText(await execute('snow_unavailable_date',{draftId,action:'add',value:'bad'})),/2026-12-25/);
    assert.match(errorText(await execute('snow_query',{limit:'20'})),/limit.*integer.*20/);
    assert.deepEqual((await ok('snow_draft_get',{draftId})).value,draft,'失败步骤不改写已有草稿');
    const denied=await ctx.tools.execute({name:'snow_draft_get',arguments:{draftId},agent:secondAgent,signal:new AbortController().signal,callId:'isolation'});
    assert.equal(denied.isError,true);assert.equal(calls,0);assert.deepEqual(await ctx.snowTrip.listPackages(),[]);
    respond=()=>({answers:[{id:'save-package',selected:['暂不保存']}]});
    assert.equal((await execute('snow_commit',{draftId})).isError,true);
    assert.equal((await ok('snow_draft_get',{draftId})).value.status,'draft');
    respond=()=>({answers:[{id:'save-package',selected:['确认保存'],custom:'改两晚'}]});
    assert.equal((await execute('snow_commit',{draftId})).isError,true);
    respond=()=>({answers:[{id:'save-package',selected:['确认保存']}]});
    const success=await ok('snow_commit',{draftId}),record=packageMetadata(success.meta);
    const modelSaved=JSON.parse(success.content.find(c=>c.type==='text').text);
    assert.equal(modelSaved.quote,1299.5);assert.equal(modelSaved.amountUnit,'元');
    const savedDraft=(await ok('snow_draft_get',{draftId})).value;assert.equal(savedDraft.id,record.id);assert.equal(savedDraft.expectedRevision,1);
    assert.ok(record);assert.equal(record.quote,129950);assert.equal(record.nights,3);assert.equal(record.paid,null);
    assert.match(question,/1299.50 元/);assert.equal('sources' in record,false);
    assert.equal((await ok('snow_commit',{draftId})).value.id,record.id);
    assert.equal((await ctx.snowTrip.listPackages()).length,1,'提交重试不重复新增');
    assert.equal((await execute('snow_set_basic',{draftId,name:'不可修改'})).isError,true);
    const query=await ok('snow_query',{});assert.equal(query.value.packages[0].quote,1299.5);assert.equal(query.value.amountUnit,'元');
    await owner.dispose();await boot();assert.deepEqual(await ctx.snowTrip.getPackage(record.id),record);
    const update=(await ok('snow_draft',{id:record.id,expectedRevision:1})).value.draftId;
    await ok('snow_set_purchase',{draftId:update,purchasePlatform:'微信小程序 xxx'});
    await ok('snow_unavailable_date',{draftId:update,action:'add',value:'2026-12-25'});
    await ok('snow_pending_question',{draftId:update,action:'add',value:'房型待确认'});
    await ok('snow_pending_question',{draftId:update,action:'remove',value:'房型待确认'});
    await ok('snow_clear_field',{draftId:update,field:'description'});
    // 确认期间拒绝编辑和再次提交，确保用户确认的就是写入的快照。
    let release,started;const gate=new Promise(resolve=>{started=resolve;});
    respond=()=>{started();return new Promise(resolve=>{release=()=>resolve({answers:[{id:'save-package',selected:['确认保存']}]});});};
    const committing=execute('snow_commit',{draftId:update});await gate;
    assert.equal((await execute('snow_set_usage',{draftId:update,nights:5})).isError,true);
    assert.equal((await execute('snow_commit',{draftId:update})).isError,true);
    release();const updated=await committing;assert.equal(updated.isError,false);
    assert.equal(updated.value.revision,2);assert.equal(updated.value.description,null);assert.equal(updated.value.quote,129950);
    assert.deepEqual(updated.value.unavailableDates,['2026-12-25']);
    const stale=(await ok('snow_draft',{id:record.id,expectedRevision:2})).value.draftId;
    await ctx.snowTrip.savePackage({...updated.value,revision:3},2);
    const before=calls;assert.equal((await execute('snow_commit',{draftId:stale})).isError,true);assert.equal(calls,before);
    await ok('snow_draft_discard',{draftId:stale});
    assert.equal((await execute('snow_draft_get',{draftId:stale})).isError,true);
    const fresh=(await ok('snow_draft',{})).value.draftId;
    await ok('snow_set_basic',{draftId:fresh,name:'第二份套餐'});
    await ok('snow_set_purchase',{draftId:fresh,purchaseStatus:'unpurchased',paid:1});
    assert.equal((await execute('snow_commit',{draftId:fresh})).isError,true,'跨字段冲突在统一提交前拦截');
    await ok('snow_clear_field',{draftId:fresh,field:'paid'});
    const controller=new AbortController();respond=()=>{controller.abort();return {answers:[{id:'save-package',selected:['确认保存']}]};};
    assert.equal((await execute('snow_commit',{draftId:fresh},controller.signal)).isError,true);
    respond=()=>({answers:[{id:'save-package',selected:['确认保存']}]});
    await rename(join(root,'snow_trip.json'),join(root,'saved.json'));await mkdir(join(root,'snow_trip.json'));
    const failure=await execute('snow_commit',{draftId:fresh});assert.equal(failure.isError,true);assert.equal(failure.meta,undefined);
    assert.equal((await ctx.snowTrip.listPackages()).length,1);
    await rm(join(root,'snow_trip.json'),{recursive:true});await rename(join(root,'saved.json'),join(root,'snow_trip.json'));
    await ok('snow_commit',{draftId:fresh});
    assert.equal((await ok('snow_query',{limit:1})).value.truncated,true);
    await assert.rejects(ctx.snowTrip.archiveSession(record.sessionId),/有关联套餐/);
    await assert.rejects(ctx.snowTrip.deletePackage(record.id,2,false),/已变更/);
    await assert.rejects(ctx.snowTrip.deletePackage(record.id,3,true),/关联套餐已变更/);
    await ctx.snowTrip.deletePackage(record.id,3,false);
    const remaining=(await ctx.snowTrip.listPackages())[0];
    let finishArchive,archiveStarted;const startedArchive=new Promise(resolve=>{archiveStarted=resolve;});
    onArchive=()=>{archiveStarted();return new Promise(resolve=>{finishArchive=resolve;});};
    const deleting=ctx.snowTrip.deletePackage(remaining.id,remaining.revision,true);await startedArchive;
    const later={...remaining,id:crypto.randomUUID()};const saving=ctx.snowTrip.savePackage(later);
    await new Promise(resolve=>setImmediate(resolve));assert.equal(await ctx.snowTrip.getPackage(later.id),null);
    finishArchive();await deleting;await saving;
    onArchive=async()=>{throw new Error('归档写盘失败');};
    assert.deepEqual(await ctx.snowTrip.deletePackage(later.id,later.revision,true),{sessionId:null,archiveError:'归档写盘失败'});
    onArchive=async()=>{};await ctx.snowTrip.archiveSession(later.sessionId);
    await owner.dispose();await boot();assert.deepEqual(await ctx.snowTrip.listPackages(),[]);
    await presetScope.dispose();assert.deepEqual(ctx.tools.schemas(agent),[]);
  }finally{await owner?.dispose();await rm(root,{recursive:true,force:true});}
});
