import {test} from 'node:test';
import assert from 'node:assert/strict';
import {saveTurnDefinition as saves} from '../src/package-turns.js';
test('提交卡片在同一 callId 从运行更新为结果，失败与下一轮不串卡片',()=>{
 let state=saves.start(null,{event:{data:{turn:2}}});
 const apply=event=>{state=saves.update({state},{event});};
 apply({type:'tool/call',data:{name:'snow_commit',callId:'one'}});
 assert.deepEqual(state.items,[{callId:'one'}]);
 apply({type:'tool/result',data:{message:{source:{callId:'one'},content:[{isError:true,content:[{type:'text',text:'版本冲突'}]}]}}});
 assert.equal(state.items.length,1);assert.equal(state.items[0].error,'版本冲突');
 assert.equal(saves.buildLocationData({state},'turn').turn,2);
 assert.deepEqual(saves.start(null,{event:{data:{turn:3}}}).items,[]);
});

test('确认期间停止显示为未保存，历史回放也不显示内部异常',()=>{
 let state=saves.start(null,{event:{data:{turn:1}}});
 state=saves.update({state},{event:{type:'tool/call',data:{name:'snow_commit',callId:'cancel'}}});
 state=saves.update({state},{event:{type:'tool/result',data:{message:{source:{callId:'cancel'},content:[{isError:true,content:[{type:'text',text:'Error: ask_user_question was aborted before the user answered'}]}]}}}});
 assert.equal(state.items[0].stopped,true);
 assert.equal(state.items[0].error,null);
 assert.equal(state.items[0].done,true);
});

test('历史停止卡片从同一草稿的工具结果恢复内容，金额还原为分',()=>{
 let state=saves.start(null,{event:{data:{turn:1}}});
 const apply=event=>{state=saves.update({state},{event});};
 apply({type:'tool/call',data:{name:'snow_set_purchase',callId:'edit'}});
 apply({type:'tool/result',data:{message:{source:{callId:'edit'},content:[{content:[{type:'text',text:JSON.stringify({draftId:'draft',status:'draft',amountUnit:'元',package:{name:'历史套餐',quote:1299.5,nights:3}})}]}]}}});
 apply({type:'tool/call',data:{name:'snow_commit',callId:'save',arguments:JSON.stringify({draftId:'draft'})}});
 apply({type:'tool/result',data:{message:{source:{callId:'save'},content:[{isError:true,content:[{type:'text',text:'Error: ask_user_question was aborted before the user answered'}]}]}}});
 assert.equal(state.items[0].snapshot.preview.name,'历史套餐');
 assert.equal(state.items[0].snapshot.preview.quote,129950);
 assert.equal(state.items[0].stopped,true);
 apply({type:'tool/call',data:{name:'snow_commit',callId:'other',arguments:JSON.stringify({draftId:'another'})}});
 assert.equal(state.items[1].snapshot,undefined);
});

test('跨轮回放停止的修改卡片保留旧值与新值，不退化为套餐详情',()=>{
 const previous={id:'saved',revision:2,name:'已存套餐',nights:3,quote:120000};
 const prior={records:{'saved:2':previous},drafts:{}};
 let state=saves.start(null,{event:{data:{turn:2}}},{previous:()=>({state:prior})});
 const apply=event=>{state=saves.update({state},{event});};
 apply({type:'tool/call',data:{name:'snow_set_usage',callId:'edit'}});
 apply({type:'tool/result',data:{message:{source:{callId:'edit'},content:[{content:[{type:'text',text:JSON.stringify({draftId:'draft',id:'saved',expectedRevision:2,status:'draft',amountUnit:'元',package:{name:'已存套餐',nights:4,quote:1200}})}]}]}}});
 apply({type:'tool/call',data:{name:'snow_commit',callId:'save',arguments:JSON.stringify({draftId:'draft'})}});
 assert.equal(state.items[0].snapshot.previous.nights,3);
 assert.equal(state.items[0].snapshot.preview.nights,4);
 assert.equal(prior.drafts.draft,undefined);
});

test('方案核算与保存进入轮次卡片，失败保留原因，不影响套餐确认流程',()=>{
 let state=saves.start(null,{event:{data:{turn:1}}});
 const apply=event=>{state=saves.update({state},{event});};
 apply({type:'tool/call',data:{name:'snow_evaluate',callId:'eval',arguments:'{}'}});
 apply({type:'tool/call',data:{name:'snow_save_plan',callId:'save',arguments:'{}'}});
 apply({type:'tool/call',data:{name:'snow_query',callId:'query'}});
 assert.deepEqual(state.items.map(i=>[i.kind,i.done]),[['snow_evaluate',undefined],['snow_save_plan',undefined]]);
 apply({type:'tool/result',data:{message:{source:{callId:'eval'},content:[{isError:true,content:[{type:'text',text:'核算脚本执行失败：ReferenceError: x is not defined'}]}]}}});
 apply({type:'tool/result',data:{meta:{version:1,status:'saved',plan:{id:'p'}},message:{source:{callId:'save'},content:[{content:[{type:'text',text:'{"status":"saved"}'}]}]}}});
 const [evaluation,plan]=state.items;
 assert.equal(evaluation.error,'核算脚本执行失败：ReferenceError: x is not defined');
 assert.equal(plan.error,null);
 assert.equal(plan.meta.plan.id,'p');
 assert.equal(state.items.length,2,'snow_query 不生成轮次卡片');
});
