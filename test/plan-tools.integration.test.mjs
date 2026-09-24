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
import {evaluateMetadata,planMetadata} from '../lib/types/plans.js';

test('方案闭环：核算校验版本与完整状态，保存核查版本并逐份持久化',async()=>{
  const root=await mkdtemp(join(tmpdir(),'snow-plan-'));
  let ctx,agent,presetScope,owner;
  async function boot(){
    const rootContext=new Context();
    owner=rootContext.plugin({async apply(scope){ctx=scope;
    await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);
    await ctx.plugin(Storage);await ctx.plugin(StorageJson,{root});await ctx.plugin(StorageDomain,{backend:'json'});
    ctx.provide('userQuestions',{ask:async()=>{throw new Error('方案工具不弹确认');}});
    ctx.provide('workspaceRegistry',{archiveSession:async()=>{}});
    await ctx.plugin(SnowTrip);
    }});await owner;ctx=rootContext;
    await ctx.snowTrip.listPackages();
    const presetKey={};
    await ctx.plugin({inject:['snowTrip','tools','userQuestions'],async apply(inner){
      presetScope=createScope(inner,presetKey);
      await presetScope.ctx.plugin(SnowTools);
    }});
    agent={id:'plan-session'};
    bindScopeParent(agent,presetKey);
  }
  const execute=(name,args,signal=new AbortController().signal)=>ctx.tools.execute({name,arguments:args,agent,signal,callId:`call-${Math.random()}`});
  const ok=async(name,args)=>{const r=await execute(name,args);assert.equal(r.isError,false,JSON.stringify(r));return r;};
  try{
    await boot();
    // 准备两个资料完整的套餐（直接经域表写入，录入流程已有独立检查）。
    const make=async(name,quote,paid)=>({name,description:name+'说明',hotels:[name+'酒店'],roomType:'双床',resort:name+'雪场',region:'长白山',nights:4,purchaseStatus:'purchased',purchasePlatform:'测试平台',quote:quote*100,paid:paid*100,paidExtra:0,usedNights:0,voided:false,validFrom:'2026-12-01',validTo:'2027-03-31',splitAllowed:true,splitRule:'可拆分使用',skiIncluded:true,skiTickets:2,skiBasis:'night',skiRule:'含每日雪票',breakfastIncluded:true,breakfastPeople:2,breakfastBasis:'day',breakfastRule:'每日双人早餐',spaIncluded:false,otherBenefits:[],surchargeRules:[],unavailableDates:[],pendingQuestions:[]});
    const now=new Date().toISOString();
    const {normalizePackage,packageRecord}=await import('../lib/types/packages.js');
    const records=[];
    for(const [name,quote,paid] of [['温泉套餐',900,900],['基础套餐',1200,1200]]){
      const base=await make(name,quote,paid);
      const normalized=normalizePackage(base);
      const record=packageRecord.parse({...normalized,id:crypto.randomUUID(),revision:1,schemaVersion:1,createdAt:now,updatedAt:now,sessionId:'plan-session'});
      await ctx.snowTrip.savePackage(record);
      records.push(await ctx.snowTrip.getPackage(record.id));
    }
    // 资料未完成与不存在套餐不能参与计算。
    // 版本校验先行（此时尚未改资料）。
    const wrongRev=await execute('snow_evaluate',{combos:[{packageId:records[0].id,revision:99,nights:2,start:'2026-12-04'}]});
    assert.match(wrongRev.content[0].text,/版本已变更/);
    const missing=await execute('snow_evaluate',{combos:[{packageId:crypto.randomUUID(),revision:1,nights:2,start:'2026-12-04'}]});
    assert.match(missing.content[0].text,/不存在/);
    // 完整套餐：返回沙箱与持久化 metadata。
    const good=await ok('snow_evaluate',{combos:[
      {packageId:records[1].id,revision:1,nights:2,start:'2026-12-04'},
      {packageId:records[0].id,revision:1,nights:2,start:'2026-12-06'},
    ]});
    const result=JSON.parse(good.content.find(c=>c.type==='text').text);
    assert.equal(result.combos.length,2);assert.ok(result.scriptSandbox);
    assert.equal(result.scriptSandbox.combos[0].quote,1200);
    assert.equal(result.scriptSandbox.combos[1].quote,900);
    const meta=evaluateMetadata(good.meta);
    assert.ok(meta);assert.equal(meta.combos[0].snapshot.name,'基础套餐');assert.equal(meta.amountUnit,'元');
    assert.equal(planMetadata(good.meta),null);
    // 资料未完成的套餐不能参与计算；旧版本结果不能沿用。
    const incomplete=await ctx.snowTrip.getPackage(records[0].id);
    await ctx.snowTrip.savePackage({...incomplete,description:null,revision:2},1);
    const blocked=await execute('snow_evaluate',{combos:[{packageId:records[0].id,revision:2,nights:2,start:'2026-12-04'}]});
    assert.match(blocked.content[0].text,/资料未完成/);
    const stale=await execute('snow_evaluate',{combos:[{packageId:records[0].id,revision:1,nights:2,start:'2026-12-04'}]});
    assert.match(stale.content[0].text,/版本已变更/);
    // 保存：版本变化拒绝；完整数据成功并持久化。
    const plan=items=>({title:'测试方案',start:'2026-12-04',nights:4,budget:2200,total:2120,paid:2100,pending:20,reason:'价格最低',allocation:'1200 元 4 晚按 2 晚分摊 600 元',estimates:[{label:'交通',amount:300,basis:'用户接受'}],items,daily:[{date:'2026-12-04',packageId:items[0].packageId,amount:300,basis:'分摊'},{date:'2026-12-05',packageId:items[0].packageId,amount:300,basis:'分摊'}],sharedCosts:[{label:'餐饮',amount:240,basis:'估算'}],unknowns:['实时有房']});
    const staleSave=await execute('snow_save_plan',{plan:plan([{packageId:records[1].id,revision:99,nights:2,start:'2026-12-04'}])});
    assert.match(staleSave.content[0].text,/已变更.*未保存|已变更/);
    const blockedSave=await execute('snow_save_plan',{plan:plan([{packageId:records[0].id,revision:2,nights:2,start:'2026-12-06'}])});
    assert.match(blockedSave.content[0].text,/资料未完成/);
    const saved=await ok('snow_save_plan',{plan:plan([{packageId:records[1].id,revision:1,nights:2,start:'2026-12-04'}])});
    const savedValue=JSON.parse(saved.content.find(c=>c.type==='text').text);
    assert.equal(savedValue.status,'saved');assert.equal(savedValue.total,2120);
    const planMeta=planMetadata(saved.meta);
    assert.ok(planMeta);assert.equal(planMeta.packages.length,1);assert.equal(planMeta.total,212000);
    assert.deepEqual((await ctx.snowTrip.listPlans()).map(p=>p.id),[planMeta.id]);
    assert.deepEqual((await ctx.snowTrip.getPlan(planMeta.id)).title,'测试方案');
    assert.equal(await ctx.snowTrip.getPlan(crypto.randomUUID()),null);
    // 非法金额与引用校验。
    const badMoney=await execute('snow_save_plan',{plan:{...plan([{packageId:records[1].id,revision:1,nights:2,start:'2026-12-04'}]),total:100.005}});
    assert.match(badMoney.content[0].text,/最多两位小数/);
    const badRef=await execute('snow_save_plan',{plan:{...plan([{packageId:records[1].id,revision:1,nights:2,start:'2026-12-04'}]),daily:[{date:'2026-12-04',packageId:crypto.randomUUID(),amount:100,basis:'无'}]}});
    assert.match(badRef.content[0].text,/不在本次搭配中/);
    // 存储重开可读取；写盘失败准确返回失败，不产生成功 metadata。
    const plansBefore=await ctx.snowTrip.listPlans();
    await ctx.snowTrip.savePlan({...plansBefore[0],id:crypto.randomUUID(),title:'第二份'});
    assert.equal((await ctx.snowTrip.listPlans()).length,2);
    // 存储重开（dispose 后重新打开同一目录）后可读取，方案不丢。
    await owner.dispose();await boot();
    const reopened=await ctx.snowTrip.listPlans();
    assert.equal(reopened.length,2);
    assert.deepEqual(reopened.map(p=>p.title).sort(),['测试方案','第二份']);
  }finally{await presetScope?.dispose();await owner?.dispose();await rm(root,{recursive:true,force:true});}
});