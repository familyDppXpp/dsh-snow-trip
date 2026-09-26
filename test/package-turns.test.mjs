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

test('无需交互的核算过程不进入消息卡片',()=>{
 let state=saves.start(null,{event:{data:{turn:1}}});
 state=saves.update({state},{event:{type:'tool/call',data:{name:'snow_evaluate',callId:'eval'}}});
 state=saves.update({state},{event:{type:'tool/result',data:{message:{source:{callId:'eval'},content:[{isError:true,content:[{type:'text',text:'参数错误'}]}]}}}});
 assert.deepEqual(state.items,[]);
});

test('确认结果立即发布独立消息，无需 turn/end；取消不发布',async()=>{
 const {confirmedPlanDefinition:d}=await import('../src/package-turns.js');
 const meta={status:'prepared',conditions:{start:'2027-02-06'}};
 const event={type:'tool/result',seq:45,surfaceOp:'append',data:{meta,message:{source:{callId:'prepare'}}}};
 assert.deepEqual(d.match(event),{id:'prepare',role:'start'});
 const location={kind:'step',turn:{turn:4},step:{step:1}};
 const context={key:'confirmation',id:'prepare',start:{event,location},state:d.start(null,{event})};
 const node=d.buildViewNode(context);
 assert.deepEqual(node.location,{kind:'session'},'业务卡片不可进入宿主轮次过程折叠');assert.equal(node.target,'chat');assert.equal(node.anchorSeq,45);assert.equal(node.data,meta);assert.equal(node.visibility,'visible');
 assert.equal(d.match({...event,data:{...event.data,meta:{status:'adjusting'}}}),null);
});

test('通用提问完成后发布独立回答卡，待回答和技术失败不伪造记录',async()=>{
 const {questionAnswerDefinition:d}=await import('../src/package-turns.js');
 const event={type:'tool/call',seq:1,data:{name:'ask_user_question',callId:'q',arguments:JSON.stringify({questions:[{id:'date',header:'出行日期',question:'哪天出发？'}]})}};
 const context={key:'q',id:'q',state:d.start(null,{event})};
 assert.equal(d.buildViewNode(context),null);
 const result={type:'tool/result',seq:2,surfaceOp:'append',data:{message:{source:{callId:'q'},content:[{type:'text',text:JSON.stringify({answers:[{id:'date',selected:['2月6日'],custom:'住7晚'}]})}]}}};
 assert.equal(d.match(result).id,'q');
 const failed={...result,data:{message:{...result.data.message,isError:true}}};
 assert.equal(d.buildViewNode({...context,state:d.update(context,{event:failed})}),null);
 context.state=d.update(context,{event:result});
 const node=d.buildViewNode(context);assert.deepEqual(node.location,{kind:'session'});assert.equal(node.data.questions[0].header,'出行日期');assert.equal(node.data.answers[0].custom,'住7晚');
});
