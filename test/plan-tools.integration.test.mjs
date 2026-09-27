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
  let ctx,agent,presetScope,owner,archiveFailure=false;const archived=[];
  const confirmAnswer=request=>{const c=JSON.parse(request.questions[0].detail);return {answers:[{id:request.questions[0].id,selected:['生成方案'],custom:JSON.stringify({values:{...c.input,budget:c.input.budget??''},ids:c.ids,fees:c.fees})}]};};
  let answer=async request=>request.questions[0].id.startsWith('snow-plan-confirm-')?confirmAnswer(request):({answers:[{id:request.questions[0].id,selected:['保存所选'],custom:JSON.stringify({stage:'results',selected:[0]})}]});
  async function boot(){
    const rootContext=new Context();
    owner=rootContext.plugin({async apply(scope){ctx=scope;
    await ctx.plugin(SystemPrompt);await ctx.plugin(Tools);
    await ctx.plugin(Storage);await ctx.plugin(StorageJson,{root});await ctx.plugin(StorageDomain,{backend:'json'});
    ctx.provide('userQuestions',{ask:request=>answer(request)});
    ctx.provide('workspaceRegistry',{archiveSession:async id=>{if(archiveFailure)throw new Error('归档失败');archived.push(id);}});
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
    const prepare=async(extra={})=>JSON.parse((await ok('snow_prepare_plan',{conditions:{start:'2026-12-04',nights:2,rooms:1,budget:200000,fees:[{id:'meal',label:'餐饮',quantity:2,unitPrice:10000,basis:'用户提供每日 100 元',source:'user'}],...extra},needsConfirmation:false,userEvidence:'12月4日住两晚，一间房，每日餐饮100元，预算2000元'})).content[0].text);
    const saveAnswer=answer;
    answer=async request=>{const card=JSON.parse(request.questions[0].detail);assert.equal(card.planning,true);return {answers:[{id:request.questions[0].id,selected:['生成方案'],custom:JSON.stringify({values:{start:'2026-12-04',nights:'2',budget:'2000',rooms:'1'},ids:[],fees:card.fees.map(f=>({...f,unitPrice:12345}))})}]};};
    const confirmed=JSON.parse((await ok('snow_prepare_plan',{conditions:{start:'2026-12-04',nights:2,rooms:1,fees:[{id:'meal',label:'餐饮',quantity:2,unitPrice:10000,basis:'模型估算',source:'estimate'}]},needsConfirmation:true})).content[0].text);
    assert.equal(confirmed.confirmedByCard,true);assert.equal(confirmed.conditions.fees[0].unitPrice,12345);assert.equal(confirmed.conditions.budget,200000);
    answer=async()=>{throw new Error('技术重试不应再次询问用户');};
    const repeated=JSON.parse((await ok('snow_prepare_plan',{conditions:confirmed.conditions,needsConfirmation:true})).content[0].text);
    assert.equal(repeated.planningId,confirmed.planningId);
    let asked=0;
    answer=async request=>{asked++;const card=JSON.parse(request.questions[0].detail);return {answers:[{id:request.questions[0].id,selected:['生成方案'],custom:JSON.stringify({values:{start:card.input.start,nights:String(card.input.nights),rooms:'1',budget:''},ids:card.ids,fees:card.fees})}]};};
    const unlimitedConditions={...confirmed.conditions};delete unlimitedConditions.budget;
    const unlimitedArgs={conditions:unlimitedConditions,needsConfirmation:true};
    const unlimited=JSON.parse((await ok('snow_prepare_plan',unlimitedArgs)).content[0].text);
    assert.equal(asked,1,'更改预算需要重新确认');assert.equal(unlimited.conditions.budget,null);
    const unlimitedRetry=JSON.parse((await ok('snow_prepare_plan',unlimitedArgs)).content[0].text);
    assert.equal(asked,1,'不限预算技术重试不得重复确认');assert.equal(unlimitedRetry.planningId,unlimited.planningId);
    answer=saveAnswer;
    const p=await prepare();
    const items=[{packageId:records[0].id,revision:1,nights:2,start:'2026-12-04'}];
    const script='return {daily:items.flatMap(s=>Array.from({length:s.nights},(_,i)=>({date:new Date(Date.parse(s.start)+i*86400000).toISOString().slice(0,10),packageId:s.packageId,surcharge:0,basis:"无日期补款"}))),coverage:[],total:65000}';
    const input={planningId:p.planningId,title:'测试方案',reason:'整趟成本较低',items,script};
    // 对外声明具有嵌套整数字段，不能再把 items 声明为任意 JSON。
    const def=ctx.tools.get('snow_evaluate',agent);
    assert.ok(JSON.stringify(def.parameters).includes('integer'));
    const badType=await execute('snow_evaluate',{...input,items:[{...items[0],revision:'1',nights:'2'}]});
    assert.equal(badType.isError,true);
    assert.match(badType.content[0].text,/revision|nights/);
    const zero=await execute('snow_evaluate',{...input,items:[{...items[0],nights:0}]});assert.match(zero.content[0].text,/items\[0\].nights/);
    const wrong=await execute('snow_evaluate',{...input,items:[{...items[0],revision:99}]});assert.match(wrong.content[0].text,/版本/);
    const syntax=await execute('snow_evaluate',{...input,script:'return {'});assert.match(syntax.content[0].text,/script/);
    const wrongTotal=await execute('snow_evaluate',{...input,script:script.replace('65000','1')});assert.match(wrongTotal.content[0].text,/65000/);
    const missingDay=await execute('snow_evaluate',{...input,script:'return {daily:[],coverage:[],total:0}'});assert.equal(missingDay.isError,true);
    assert.equal((await ctx.snowTrip.listCalculations(p.planningId)).length,0);
    const computed=JSON.parse((await ok('snow_evaluate',input)).content[0].text);
    assert.equal(computed.status,'computed');assert.equal(computed.passed,1);
    const result=await ctx.snowTrip.getCalculation(computed.resultId);
    assert.equal(result.plan.total,65000);assert.equal(result.plan.daily[0].amount,22500);assert.equal(result.plan.sharedCosts[0].amount,20000);
    const {validateSegments,calculate}=await import('../lib/types/planning.js');
    const planning=await ctx.snowTrip.getPlanning(p.planningId);
    assert.throws(()=>validateSegments(planning,[{...items[0],start:'2026-12-05'}],records),/连续入住/);
    assert.throws(()=>validateSegments(planning,items,[{...records[0],splitAllowed:false}]),/不可拆分/);
    assert.throws(()=>validateSegments(planning,items,[{...records[0],usedNights:3}]),/剩余间夜/);
    assert.throws(()=>validateSegments(planning,items,[{...records[0],unavailableDates:['2026-12-05']}]),/不可用日期/);
    assert.throws(()=>validateSegments(planning,items,[{...records[0],validTo:'2026-12-04'}]),/有效期/);
    const out={daily:items.flatMap(i=>[0,1].map(n=>({date:`2026-12-0${4+n}`,packageId:i.packageId,surcharge:0,basis:'测试'}))),coverage:[{feeId:'meal',quantity:1,basis:'套餐覆盖一次正餐'}],total:55000};
    assert.equal(calculate(planning,items,[records[0]],out,'权益核算','测试').plan.total,55000);
    assert.throws(()=>calculate(planning,items,[records[0]],{...out,coverage:[{feeId:'meal',quantity:3,basis:'错误'}]},'测试','测试'),/覆盖数量/);
    const rounded=calculate(planning,items,[{...records[0],paid:90001}],{...out,total:55001},'尾差','测试');
    assert.deepEqual(rounded.plan.daily.map(d=>d.amount),[22501,22500]);
    const list=JSON.parse((await ok('snow_plan_results',{planningId:p.planningId,complete:true})).content[0].text);
    assert.equal(list.comparisonComplete,true);assert.equal(list.results[0].resultId,computed.resultId);
    // 结果卡不能接受模型填写的金额，旧接口不再是绕过核算的入口。
    const forged=await execute('snow_plan_stage',{stage:'results',key:'forged',detail:{results:[{total:1}]}});assert.equal(forged.isError,true);
    answer=async request=>({answers:[{id:request.questions[0].id,selected:['取消本次操作']}]});
    for(const [name,args] of [['snow_save_plan',{resultId:computed.resultId}],['snow_plan_stage',{stage:'results',key:'cancel',planningId:p.planningId}]]){
      const cancelled=await ok(name,args);assert.equal(cancelled.concludesTurn,true);assert.equal(JSON.parse(cancelled.content[0].text).interaction.action,'cancel');
    }
    answer=async request=>({answers:[{id:request.questions[0].id,selected:[],custom:'先比较两份方案的雪票费用'}]});
    for(const [name,args] of [['snow_save_plan',{resultId:computed.resultId}],['snow_plan_stage',{stage:'results',key:'supplement',planningId:p.planningId}]]){
      const response=await ok(name,args),feedback=JSON.parse(response.content[0].text).interaction;
      assert.equal(feedback.action,'supplement');assert.equal(feedback.custom,'先比较两份方案的雪票费用');assert.equal(feedback.card.results[0].resultId,computed.resultId);assert.notEqual(response.concludesTurn,true);
    }
    assert.deepEqual(await ctx.snowTrip.listPlans(),[]);answer=saveAnswer;
    assert.deepEqual(JSON.parse((await ok('snow_list_plans',{})).content[0].text),{plans:[],amountUnit:'分'},'未保存的核算结果不应出现在已存方案列表');
    assert.equal((await execute('snow_list_plans',{id:computed.resultId})).isError,true);
    const saved=JSON.parse((await ok('snow_save_plan',{resultId:computed.resultId})).content[0].text);
    assert.deepEqual(JSON.parse((await ok('snow_list_plans',{})).content[0].text),{plans:[saved.plan],amountUnit:'分'});
    const queried=JSON.parse((await ok('snow_query_plan',{id:saved.plan.id})).content[0].text);
    assert.deepEqual(queried.plan,saved.plan);assert.equal(queried.amountUnit,'分');
    assert.equal((await execute('snow_query_plan',{id:'invalid'})).isError,true);
    assert.equal((await execute('snow_query_plan',{id:crypto.randomUUID()})).isError,true);
    assert.equal(saved.plan.total,65000);assert.equal((await ctx.snowTrip.listPlans()).length,1);
    await ok('snow_save_plan',{resultId:computed.resultId});assert.equal((await ctx.snowTrip.listPlans()).length,1);
    // 标签独立持久化；重复保存核算快照不能覆盖用户更新的标签。
    const tracking={booking:'unreserved',refund:'refundable',refundPolicy:'2月4日00:00前可退'};
    assert.deepEqual((await ctx.snowTrip.updatePlanTracking(saved.plan.id,tracking)).tracking,tracking);
    await ctx.snowTrip.savePlan(saved.plan);
    assert.deepEqual((await ctx.snowTrip.getPlan(saved.plan.id)).tracking,tracking);
    await assert.rejects(()=>ctx.snowTrip.updatePlanTracking(saved.plan.id,{...tracking,refundPolicy:'  '}));
    await assert.rejects(()=>ctx.snowTrip.updatePlanTracking(saved.plan.id,{...tracking,refund:'nonrefundable'}));
    await assert.rejects(()=>ctx.snowTrip.updatePlanTracking(crypto.randomUUID(),tracking),/不存在/);
    const changed={booking:'confirmed',refund:'nonrefundable',refundPolicy:null};
    assert.deepEqual((await ctx.snowTrip.updatePlanTracking(saved.plan.id,changed)).tracking,changed);
    // 自然语言工具只更新明确给出的字段，不弹确认卡，不更改费用。
    const previousAnswer=answer;answer=async()=>{throw new Error('标签更新不应弹确认卡');};
    const updateTracking=async fields=>JSON.parse((await ok('snow_update_plan_tracking',{id:saved.plan.id,...fields})).content[0].text).plan;
    assert.equal((await execute('snow_update_plan_tracking',{id:saved.plan.id})).isError,true);
    assert.equal((await execute('snow_update_plan_tracking',{id:saved.plan.id,refund:'refundable'})).isError,true);
    assert.equal((await execute('snow_update_plan_tracking',{id:crypto.randomUUID(),booking:'confirmed'})).isError,true);
    let tagged=await updateTracking({refund:'refundable',refundPolicy:'  未预约可退  '});
    assert.deepEqual(tagged.tracking,{booking:'confirmed',refund:'refundable',refundPolicy:'未预约可退'});
    tagged=await updateTracking({booking:'unreserved'});
    assert.deepEqual(tagged.tracking,{booking:'unreserved',refund:'refundable',refundPolicy:'未预约可退'});
    assert.equal(tagged.total,saved.plan.total);assert.deepEqual(tagged.items,saved.plan.items);
    assert.equal((await updateTracking({refundPolicy:'2月4日00:00前可退'})).tracking.refundPolicy,'2月4日00:00前可退');
    assert.equal((await updateTracking({refund:'nonrefundable'})).tracking.refundPolicy,null);
    assert.deepEqual((await updateTracking({booking:'unknown',refund:'unknown'})).tracking,{booking:null,refund:null,refundPolicy:null});
    assert.equal((await execute('snow_update_plan_tracking',{id:saved.plan.id,refundPolicy:'不可凭空增加策略'})).isError,true);
    answer=previousAnswer;
    const second=JSON.parse((await ok('snow_evaluate',{...input,title:'第二候选'})).content[0].text);
    const realSave=ctx.snowTrip.savePlan.bind(ctx.snowTrip);let failedAttempts=0;
    ctx.snowTrip.savePlan=async plan=>{if(plan.id===second.resultId){failedAttempts++;throw new Error('模拟写盘失败');}return realSave(plan);};
    answer=async request=>({answers:[{id:request.questions[0].id,selected:['保存所选'],custom:JSON.stringify({stage:'results',selected:[0,1]})}]});
    const partial=JSON.parse((await ok('snow_plan_stage',{stage:'results',key:'save-both',planningId:p.planningId,resultIds:[computed.resultId,second.resultId]})).content[0].text);
    assert.deepEqual(partial.items.map(r=>r.status),['saved','failed']);assert.equal(failedAttempts,1);
    ctx.snowTrip.savePlan=realSave;answer=saveAnswer;
    // 更改规划后，旧核算记录保留但不能作为新条件下的结果使用。
    const newer=await prepare({budget:60000});
    assert.equal((await execute('snow_save_plan',{resultId:computed.resultId})).isError,true);
    const over=await execute('snow_evaluate',{...input,planningId:newer.planningId});assert.match(over.content[0].text,/超过预算/);
    assert.ok(await ctx.snowTrip.getCalculation(computed.resultId));
    // 停止终止异步脚本，保留已经通过的候选。
    const latest=await prepare();
    await ok('snow_evaluate',{...input,planningId:latest.planningId});
    const controller=new AbortController();
    setTimeout(()=>controller.abort(new Error('用户停止')),100);
    await execute('snow_evaluate',{...input,planningId:latest.planningId,script:'await Promise.resolve(); while(true){}'},controller.signal);
    assert.equal((await ctx.snowTrip.listCalculations(latest.planningId)).length,1);
    assert.equal((await ctx.snowTrip.getPlanning(latest.planningId)).status,'stopped');
    // 套餐改变后结果不能保存。
    await ctx.snowTrip.savePackage({...records[0],revision:2},1);
    const stale=await execute('snow_save_plan',{resultId:(await ctx.snowTrip.listCalculations(latest.planningId))[0].id});assert.match(stale.content[0].text,/版本/);
    const legacy={...await ctx.snowTrip.getPlanning(latest.planningId),id:crypto.randomUUID(),confirmedByCard:false};await ctx.snowTrip.createPlanning(legacy);
    assert.match((await execute('snow_evaluate',{...input,planningId:legacy.id})).content[0].text,/缺少卡片确认记录/);
    await owner.dispose();await boot();
    assert.equal((await ctx.snowTrip.listPlans()).length,1);
    assert.equal((await ctx.snowTrip.getCalculation(computed.resultId)).plan.total,65000);
    const packagesBefore=await ctx.snowTrip.listPackages();
    await assert.rejects(ctx.snowTrip.deletePlan('invalid-id'));
    assert.equal((await ctx.snowTrip.listPlans()).length,1);
    // 写入失败不应丢失内存中的方案。
    await rename(root,root+'-backup');
    await (await import('node:fs/promises')).writeFile(root,'阻止写入');
    try{await assert.rejects(ctx.snowTrip.deletePlan(computed.resultId));assert.ok(await ctx.snowTrip.getPlan(computed.resultId));}
    finally{await rm(root);await rename(root+'-backup',root);}
    await ctx.snowTrip.deletePlan(computed.resultId);
    await ctx.snowTrip.deletePlan(computed.resultId);
    assert.equal(await ctx.snowTrip.getPlan(computed.resultId),null);
    assert.deepEqual(await ctx.snowTrip.listPackages(),packagesBefore);
    assert.ok(await ctx.snowTrip.getCalculation(computed.resultId));
    await owner.dispose();await boot();
    assert.deepEqual(await ctx.snowTrip.listPlans(),[]);
    assert.deepEqual(await ctx.snowTrip.listPackages(),packagesBefore);
    await ctx.snowTrip.savePlan({...saved.plan,id:crypto.randomUUID(),packages:saved.plan.packages.map(entry=>{const record=packagesBefore.find(p=>p.id===entry.id);return {...entry,revision:record.revision,snapshot:record};}),items:saved.plan.items.map(item=>({...item,revision:packagesBefore.find(p=>p.id===item.packageId).revision}))});
    const remaining=(await ctx.snowTrip.listPlans())[0];
    await assert.rejects(ctx.snowTrip.archiveSession(remaining.sessionId),/关联/);
    for(const record of packagesBefore)await ctx.snowTrip.savePackage(record);
    const archivePlan={...remaining,id:crypto.randomUUID(),sessionId:'archive-plan-session'};
    const siblingPlan={...archivePlan,id:crypto.randomUUID()};
    await ctx.snowTrip.savePlan(archivePlan);await ctx.snowTrip.savePlan(siblingPlan);
    const before=archived.length;
    await assert.rejects(ctx.snowTrip.archiveSession(archivePlan.sessionId),/关联方案/);
    assert.deepEqual(await ctx.snowTrip.deletePlan(archivePlan.id),{sessionId:null,archiveError:null});
    assert.equal(archived.length,before);
    assert.deepEqual(await ctx.snowTrip.deletePlan(siblingPlan.id),{sessionId:siblingPlan.sessionId,archiveError:null});
    assert.equal(archived.at(-1),siblingPlan.sessionId);
    await ctx.snowTrip.deletePlan(siblingPlan.id);assert.equal(archived.length,before+1);
    const failed={...archivePlan,id:crypto.randomUUID()};await ctx.snowTrip.savePlan(failed);archiveFailure=true;
    assert.deepEqual(await ctx.snowTrip.deletePlan(failed.id),{sessionId:null,archiveError:'归档失败'});
    assert.equal(await ctx.snowTrip.getPlan(failed.id),null);
    archiveFailure=false;await ctx.snowTrip.archiveSession(failed.sessionId);
    const cascadePlan={...remaining,id:crypto.randomUUID(),sessionId:'cascade-plan-session'};await ctx.snowTrip.savePlan(cascadePlan);
    const target=packagesBefore[0],otherPackages=packagesBefore.slice(1);
    await assert.rejects(ctx.snowTrip.deletePackage(target.id,target.revision,false),/受影响的方案已变更/);
    assert.ok(await ctx.snowTrip.getPackage(target.id));assert.ok(await ctx.snowTrip.getPlan(remaining.id));
    await assert.rejects(ctx.snowTrip.deletePackage(target.id,target.revision,false,[remaining.id]),/受影响的方案已变更/);
    assert.deepEqual(await ctx.snowTrip.deletePackage(target.id,target.revision,false,[remaining.id,cascadePlan.id]),{sessionId:null,archiveError:null});
    assert.equal(await ctx.snowTrip.getPackage(target.id),null);assert.deepEqual(await ctx.snowTrip.listPlans(),[]);
    assert.ok(archived.includes('cascade-plan-session'));
    for(const record of otherPackages)assert.ok(await ctx.snowTrip.getPackage(record.id));
    await owner.dispose();await boot();assert.equal(await ctx.snowTrip.getPackage(target.id),null);assert.deepEqual(await ctx.snowTrip.listPlans(),[]);


  }finally{await presetScope?.dispose();await owner?.dispose();await rm(root,{recursive:true,force:true});}
});
