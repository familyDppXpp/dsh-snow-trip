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
  async function boot(){
    const rootContext=new Context();
    owner=rootContext.plugin({async apply(scope){ctx=scope;
    await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);
    await ctx.plugin(Storage);await ctx.plugin(StorageJson,{root});await ctx.plugin(StorageDomain,{backend:'json'});
    ctx.provide('userQuestions',{ask:async request=>{calls++;question=request.questions[0].detail;return respond();}});
    await ctx.plugin(SnowTrip);
    }});await owner;ctx=rootContext;
    assert.equal(ctx.tools.schemas().some(tool=>tool.name.startsWith('snow_')),false,'宿主层不应注册雪季工具');
    agent={...agent};secondAgent={...agent,id:'second-session'};
    const presetKey={};
    await ctx.plugin({inject:['snowTrip','tools','userQuestions'],async apply(inner){
      presetScope=createScope(inner,presetKey);
      await presetScope.ctx.plugin(SnowTools);
    }});
    bindScopeParent(agent,presetKey);bindScopeParent(secondAgent,presetKey);
    assert.deepEqual(ctx.tools.schemas(agent).map(t=>t.name).sort(),['snow_query','snow_save_packages']);
    assert.deepEqual(ctx.tools.schemas(secondAgent).map(t=>t.name).sort(),['snow_query','snow_save_packages']);
    assert.deepEqual(ctx.tools.schemas({id:'ordinary-session'}),[]);
    assert.deepEqual(ctx.tools.schemas(),[]);
    const denied=await ctx.tools.execute({name:'snow_query',arguments:{},agent:{id:'ordinary-session'},signal:new AbortController().signal,callId:'denied'});
    assert.equal(denied.isError,true);
    return ctx.snowTrip.listPackages();
  }
  let agent={id:'test-session',session:{snapshotEvents:()=>[{seq:0,type:'user/message',data:{source:{kind:'plugin',plugin:'runtime-context'},content:[{type:'text',text:'宿主注入内容不得成为套餐来源'}]}},{seq:1,type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'长白山住宿，还没买，报价 1299 元。'}]}},{seq:2,type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'晚数暂时不知道，先保存资料。'}]}}]}};
  const execute=(name,args,signal=new AbortController().signal)=>ctx.tools.execute({name,arguments:args,agent,signal,callId:`call-${Math.random()}`});
  const input={package:{description:'长白山住宿',quote:129900,purchaseStatus:'unpurchased'}};
  try{
    assert.deepEqual(TYPERT.invocations.map(i=>i.id).sort(),['ensureWorkspace','getPackage','listPackages'].map(name=>`dsh-snow-trip#snowTrip/${name}`).sort());
    assert.deepEqual(await boot(),[]);
    for(const args of [{package:{}},{...input,confirmed:true},{package:{...input.package,confirmed:true}},{package:{...input.package,quote:-1}},{package:{...input.package,validFrom:'2026-02-30'}}]){
      const r=await execute('snow_save_packages',args);assert.equal(r.isError,true);assert.equal(r.meta,undefined);
    }
    assert.equal(calls,0);
    respond=()=>({answers:[{id:'save-package',selected:['暂不保存']}]});
    assert.equal((await execute('snow_save_packages',input)).isError,true);assert.deepEqual(await ctx.snowTrip.listPackages(),[]);
    respond=()=>({answers:[{id:'save-package',selected:['确认保存'],custom:'改成两晚'}]});
    assert.equal((await execute('snow_save_packages',input)).isError,true);
    respond=()=>({answers:[{id:'save-package',selected:['确认保存']}]});
    const success=await execute('snow_save_packages',input);
    assert.equal(success.isError,false,JSON.stringify(success));
    const record=packageMetadata(success.meta);assert.ok(record);
    assert.equal(record.revision,1);assert.equal(record.quote,129900);assert.equal(record.paid,null);
    assert.equal(record.nights,null);assert.equal(record.sources.length,2);assert.equal(record.purchaseStatus,'unpurchased');
    assert.match(question,/报价：1299.00 元/);assert.match(question,/总间夜：待确认/);
    assert.deepEqual(await ctx.snowTrip.getPackage(record.id),record);
    const shared=await ctx.tools.execute({name:'snow_query',arguments:{},agent:secondAgent,signal:new AbortController().signal,callId:'shared'});
    assert.equal(shared.value.packages[0].id,record.id);
    const before=calls;respond=()=>({answers:[{id:'save-package',selected:['暂不保存']}]});
    assert.equal((await execute('snow_save_packages',{package:{...input.package,quote:200000}})).isError,true);
    assert.equal(calls,before+1);assert.match(question,/2000.00 元/);
    await owner.dispose();await boot();
    assert.deepEqual(await ctx.snowTrip.getPackage(record.id),record);
    const query=await execute('snow_query',{limit:1});assert.equal(query.isError,false,JSON.stringify(query));
    assert.equal(query.value.packages[0].id,record.id);assert.equal(query.value.truncated,false);
    respond=()=>({answers:[{id:'save-package',selected:['确认保存']}]});
    await execute('snow_save_packages',{package:{name:'另一个套餐'}});
    assert.equal((await execute('snow_query',{limit:1})).value.truncated,true);
    assert.equal((await execute('snow_query',{offset:1,limit:1})).value.packages.length,1);
    const count=(await ctx.snowTrip.listPackages()).length;
    const controller=new AbortController();respond=()=>{controller.abort();return {answers:[{id:'save-package',selected:['确认保存']}]};};
    assert.equal((await execute('snow_save_packages',input,controller.signal)).isError,true);
    respond=()=>({answers:[{id:'save-package',selected:['确认保存']}]});
    await rename(join(root,'snow_trip.json'),join(root,'saved.json'));await mkdir(join(root,'snow_trip.json'));
    const failure=await execute('snow_save_packages',input);assert.equal(failure.isError,true);assert.equal(failure.meta,undefined);
    assert.equal((await ctx.snowTrip.listPackages()).length,count);
    assert.equal(packageMetadata({...success.meta,version:99}),null);
    await presetScope.dispose();
    assert.deepEqual(ctx.tools.schemas(agent),[]);
    assert.equal((await ctx.snowTrip.listPackages()).length,count);
  }finally{await owner?.dispose();await rm(root,{recursive:true,force:true});}
});
