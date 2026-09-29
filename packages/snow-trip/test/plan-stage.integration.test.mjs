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
import {wireStages,brokenEstimate} from './plan-wire-fixtures.mjs';
import {planQuestion} from '../src/shared/plan-question.ts';
import {SnowTrip} from '../lib/server/service.js';

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
    const querySchema=ctx.tools.schemas(agent).find(t=>t.name==='snow_query');
    assert.match(querySchema.parameters.properties.limit.description??'',/1.*50/,'模型应能看到每页范围');
    assert.equal((await execute('snow_query',{limit:100})).isError,true);
    assert.equal((await execute('snow_query',{limit:50})).isError,false);
    answer=async request=>{
      const card=planQuestion({questions:request.questions});assert.equal(card.invalid,undefined);assert.equal(card.planning,true);
      return {answers:[{id:request.questions[0].id,selected:[],custom:'先不要生成'}]};
    };
    const input={conditions:{start:'2027-02-06',nights:7,rooms:1,fees:[{id:'meal',label:'餐饮',quantity:7,unitPrice:10000,basis:'每日估算',source:'estimate'}]},needsConfirmation:true};
    const zeroBudget=await execute('snow_prepare_plan',{...input,conditions:{...input.conditions,budget:0}});
    assert.equal(zeroBudget.isError,true);assert.match(zeroBudget.content[0].text,/conditions.budget.*省略/);
    const cancelled=await execute('snow_prepare_plan',input);
    assert.equal(JSON.parse(cancelled.content[0].text).status,'adjusting');
    assert.equal(cancelled.concludesTurn,undefined,'有补充说明应继续模型循环');
    assert.equal(JSON.parse(cancelled.content[0].text).custom,'先不要生成');
    answer=async request=>({answers:[{id:request.questions[0].id,selected:[],custom:'加上往返机票费用'}]});
    const supplemented=await execute('snow_prepare_plan',input);
    assert.equal(supplemented.concludesTurn,undefined);
    assert.equal(JSON.parse(supplemented.content[0].text).custom,'加上往返机票费用');
    assert.equal(JSON.parse(supplemented.content[0].text).planningId,undefined);
    answer=async request=>({answers:[{id:request.questions[0].id,selected:[]}]});
    const skipped=await execute('snow_prepare_plan',input);
    assert.equal(skipped.concludesTurn,true,'无补充时保持停止等待');
    answer=async request=>({answers:[{id:request.questions[0].id,selected:['取消本次操作']}]});
    const explicitCancel=await execute('snow_prepare_plan',input);
    assert.equal(explicitCancel.concludesTurn,true);assert.equal(JSON.parse(explicitCancel.content[0].text).interaction.action,'cancel');
    const bypass=await execute('snow_prepare_plan',{...input,needsConfirmation:false,userEvidence:'用户没有确认这个估算'});
    assert.equal(bypass.isError,false);assert.equal(JSON.parse(bypass.content[0].text).interaction.action,'cancel','needsConfirmation:false 也必须等待卡片操作');
    const userOnly=await execute('snow_prepare_plan',{...input,conditions:{...input.conditions,fees:input.conditions.fees.map(f=>({...f,source:'user',unitPrice:0}))},needsConfirmation:false,userEvidence:'用户已经回答过'});
    assert.equal(JSON.parse(userOnly.content[0].text).interaction.action,'cancel','模型标注用户来源也不能跳过卡片');
    // 旧的任意 JSON 结果和独立费用阶段不能再创建业务卡片。
    for(const stage of ['confirm','estimate','results']){
      const legacy=await execute('snow_plan_stage',{stage,key:'legacy',detail:{results:[]}});assert.equal(legacy.isError,true);
    }
    assert.deepEqual(await ctx.snowTrip.listPlans(),[]);
  }finally{await presetScope?.dispose();await owner?.dispose();await rm(root,{recursive:true,force:true});}
});
