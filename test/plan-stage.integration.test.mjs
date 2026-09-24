import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Context} from '@deepseek-ai/cordis';
import {createScope,bindScopeParent} from '@deepseek-ai/dsh-scope';
import * as SnowTools from 'dsh-snow-trip/tools';
import Tools from '@deepseek-ai/dsh-tools';
import SystemPrompt from '@deepseek-ai/dsh-system-prompt';
import Storage from '@deepseek-ai/dsh-storage';
import * as StorageJson from '@deepseek-ai/dsh-storage-json';
import * as StorageDomain from '@deepseek-ai/dsh-storage-domain';
import {SnowTrip} from '../lib/service.js';

test('snow_plan_stage 展示卡片并返回用户编辑；取消保留输入不写入',async()=>{
  const root=await mkdtemp(join(tmpdir(),'snow-stage-'));
  let ctx,agent,presetScope,owner,answer=async request=>({answers:[{id:request.questions[0].id,selected:[]}]});
  async function boot(){
    const rootContext=new Context();
    owner=rootContext.plugin({async apply(scope){ctx=scope;
    await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);
    await ctx.plugin(Storage);await ctx.plugin(StorageJson,{root});await ctx.plugin(StorageDomain,{backend:'json'});
    ctx.provide('userQuestions',{ask:async request=>answer(request)});
    ctx.provide('workspaceRegistry',{archiveSession:async()=>{}});
    await ctx.plugin(SnowTrip);
    }});await owner;ctx=rootContext;
    await ctx.snowTrip.listPackages();
    const presetKey={};
    await ctx.plugin({inject:['snowTrip','tools','userQuestions'],async apply(inner){
      presetScope=createScope(inner,presetKey);
      await presetScope.ctx.plugin(SnowTools);
    }});
    agent={id:'stage-session'};
    bindScopeParent(agent,presetKey);
  }
  const execute=(name,args)=>ctx.tools.execute({name,arguments:args,agent,signal:new AbortController().signal,callId:`call-${Math.random()}`});
  try{
    await boot();
    // 用户编辑表单：custom 携带编辑负载，selected 为空。
    answer=async request=>{
      const q=request.questions[0];
      assert.equal(q.id,'snow-plan-confirm-c1');
      const detail=JSON.parse(q.detail);
      assert.equal(detail.stage,'confirm');assert.equal(detail.key,'c1');
      assert.deepEqual(detail.ids,['p1']);
      return {answers:[{id:q.id,selected:[],custom:JSON.stringify({values:{start:'2026-12-11',nights:'3',budget:'2200'},ids:['p1','p2'],estimates:[]})}]};
    };
    const edited=await execute('snow_plan_stage',{stage:'confirm',key:'c1',detail:{input:{},ids:['p1'],packages:[{id:'p1',name:'A',completeness:'complete'}]}});
    assert.equal(edited.isError,false,edited.content?.map(c=>c.text).join('\n')||'stage 失败');
    const value=JSON.parse(edited.content.find(c=>c.type==='text').text);
    assert.equal(value.status,'answered');assert.equal(value.custom,JSON.stringify({values:{start:'2026-12-11',nights:'3',budget:'2200'},ids:['p1','p2'],estimates:[]}));
    assert.deepEqual(value.selected,[]);
    // 快捷按钮：卡片按钮的标签经 selected 回传（工具不接收 options 参数）。
    answer=async request=>({answers:[{id:request.questions[0].id,selected:['保存所选']}]});
    const buttons=await execute('snow_plan_stage',{stage:'results',key:'r1',detail:{results:[{title:'搭配一',total:212000}],selected:[0]}});
    const btnValue=JSON.parse(buttons.content.find(c=>c.type==='text').text);
    assert.deepEqual(btnValue.selected,['保存所选']);assert.equal(btnValue.custom,null);
    // 用户跳过：空 selected + 空 custom，仍返回卡片数据，不阻塞流程。
    answer=async request=>({answers:[{id:request.questions[0].id,selected:[]}]});
    const skipped=await execute('snow_plan_stage',{stage:'discussion',key:'d1',detail:{results:[],selected:[],message:''}});
    assert.equal(JSON.parse(skipped.content.find(c=>c.type==='text').text).status,'answered');
    // 取消（aborted）：工具失败，无写入。
    answer=async()=>{throw new Error('ask_user_question was aborted before the user answered');};
    const aborted=await execute('snow_plan_stage',{stage:'confirm',key:'c2',detail:{}});
    assert.equal(aborted.isError,true,aborted.content?.map(c=>c.text).join('\n'));
    assert.match(aborted.content[0].text,/aborted before|无法取消|停止/);
  }finally{await presetScope?.dispose();await owner?.dispose();await rm(root,{recursive:true,force:true});}
});
