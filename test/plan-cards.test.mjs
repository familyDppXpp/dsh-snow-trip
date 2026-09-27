// 方案阶段卡片渲染检查：合成数据驱动，经 esbuild bundle 处理 JSX（同 text-import.test.mjs 模式）。
import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {build} from 'esbuild';

// react 与 react-dom 均用宿主源码树的副本（客户端 React 沿用宿主；本包不依赖 react-dom），仅供测试。
const host='/Users/liuyunxia/Documents/ai/deepseek-harness/node_modules';
let React,server;
try{
  const {createRequire}=await import('node:module');
  const hostRequire=createRequire(join=>join);
  React=await import('file://'+host.replace(/\/$/,'')+'/react/index.js').catch(()=>null);
}catch{}
// 简化：直接从宿主 .pnpm 布局解析。
const reactUrl='file://'+host+'/.pnpm/react@18.3.1/node_modules/react/index.js';
const serverUrl='file://'+host+'/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/server.node.js';
React=(await import(reactUrl)).default??(await import(reactUrl));
server=await import(process.env.SNOW_REACT_DOM_SERVER||serverUrl);
const load=async(entry='src/plan-question-card.jsx')=>{
  // external react：组件用宿主 React 渲染（与生产 bundle 一致）；经 vm require 注入宿主 React。
  const bundle=await build({entryPoints:[entry],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime'],loader:{'.css':'text'}});
  const jsx=(type,props,key)=>React.createElement(type,{...props},key);
  const requireShim=id=>{
    if(id==='react')return React;
    if(id==='react/jsx-runtime')return {jsx,jsxs:jsx,Fragment:React.Fragment};
    throw new Error('非预期依赖：'+id);
  };
  const module={exports:{}};
  vm.runInThisContext(`(function(require,module,exports){${bundle.outputFiles[0].text}\n})`,{filename:'plan-question-card.cjs'})(requireShim,module,module.exports);
  return module.exports;
};
const {PlanQuestionCard,PlanStageFailure}=await load();
const render=async(pending,packages)=>server.renderToStaticMarkup(React.createElement(PlanQuestionCard,{pending,packages}));

const packages=[
  {id:'p1',name:'山麓四晚套餐',purchaseStatus:'purchased',nights:4,splitAllowed:true,completeness:'complete'},
  {id:'p2',name:'雪松单晚套餐',purchaseStatus:'purchased',nights:1,splitAllowed:true,completeness:'complete'},
  {id:'p3',name:'湖畔套餐',purchaseStatus:'unpurchased',nights:2,splitAllowed:null,completeness:'incomplete'},
];
const pending=(stage,key,detail)=>{
  const questions=[{id:`snow-plan-${stage}-${key}`,question:'请确认',detail:JSON.stringify({stage,key,...detail})}];
  return {questions,answer:async()=>{}};
};

test('条件确认卡渲染选填表单、推荐预勾与更多套餐折叠',async()=>{
  const html=await render(pending('confirm','c1',{input:{},ids:['p1'],suggestions:{nights:3},packages}),packages);
  assert.match(html,/确认这次出行/);
  assert.match(html,/type="date"/);
  assert.match(html,/建议 3 晚/);
  assert.match(html,/山麓四晚套餐/);
  assert.match(html,/推荐/);
  assert.match(html,/更多套餐/);
  assert.match(html,/生成方案/);
  assert.match(html,/也可以直接在输入框继续说明/);
});

test('估算确认卡分项展示并可修改，建议标注区分用户事实',async()=>{
  const html=await render(pending('estimate','e1',{start:'2026-12-11',nights:3,suggested:{start:true,nights:true},estimates:[{label:'交通',amount:30000,basis:'示例估算'},{label:'餐饮',amount:10000,basis:'示例估算'}],scope:'住宿按入住日计'}),packages);
  assert.match(html,/确认计算依据/);
  assert.match(html,/建议日期/);
  assert.match(html,/建议晚数/);
  assert.match(html,/交通 \/ 元/);
  assert.match(html,/餐饮 \/ 元/);
  assert.match(html,/待确认估算/);
  assert.match(html,/接受这些条件并计算/);
  assert.match(html,/住宿按入住日计/);
});

test('结果卡展示勾选、每日费用表、分摊依据与统一操作栏',async()=>{
  const detail={results:[
    {title:'搭配一',start:'2026-12-11',end:'2026-12-14',nights:3,total:212000,paid:60000,pending:152000,budget:220000,estimated:true,daily:[{date:'2026-12-11',hotel:'山麓酒店',amount:30000,basis:'套餐分摊 30000 分；已购 1200 元 4 晚，按 3 晚分摊 900 元'}],sharedCosts:[{label:'整趟往返交通',amount:30000,basis:'用户接受'}],allocation:['山麓套餐：整单已付 ¥1,200.00，共 4 晚，本次使用 3 晚，按间夜分摊。'],checks:['脚本执行于受限沙箱'],reason:'全程住同一家，行李不用搬',switches:0},
    {title:'搭配二',total:252000,paid:60000,pending:192000,budget:220000,daily:[],reason:'拼两份套餐',switches:1},
  ],selected:[0]};
  const html=await render(pending('results','r1',detail),packages);
  assert.match(html,/找到合适的搭配/);
  assert.match(html,/优先推荐/);
  assert.match(html,/备选 2/);
  assert.match(html,/¥2,120\.00/);
  assert.match(html,/按间夜分摊/);
  assert.match(html,/套餐分摊 ¥300\.00/);
  assert.doesNotMatch(html,/30000 分/);
  assert.match(html,/整趟往返交通 ¥300\.00/);
  assert.match(html,/整趟计一次/);
  assert.match(html,/全程住同一家/);
  assert.doesNotMatch(html,/本次已付成本|预计待付/);

  assert.match(html,/预算内/);
  assert.match(html,/已选择 1 份/);
  assert.doesNotMatch(html,/继续讨论<|讨论此方案<|比较所选</);
  assert.match(html,/讨论或调整方案？补充说明/);
  assert.match(html,/保存所选（1）/);
});

test('讨论卡三态与回顾/状态卡',async()=>{
  const multi=await render(pending('discussion','d1',{results:[{title:'搭配一',total:212000,switches:0,reason:'全程同酒店'},{title:'搭配二',total:252000,switches:1,reason:'拼两份'}],selected:[0,1],message:'少换酒店'}),packages);
  assert.match(multi,/一起继续想/);
  assert.match(multi,/你的想法：少换酒店/);
  assert.match(multi,/换酒店/);
  const zero=await render(pending('discussion','d2',{results:[],selected:[],message:''}),packages);
  assert.match(zero,/不用先选方案/);
  assert.match(zero,/可以直接调整偏好/);
  const review=await render(pending('review','v1',{plan:{title:'方案 1',start:'2026-12-11',nights:3,total:212000,paid:60000,pending:152000,daily:[{date:'2026-12-11',amount:30000,basis:'分摊'}],packages:[{},{}],reason:'价格最低',unknowns:['实时有房']}}),packages);
  assert.match(review,/保存时快照/);
  assert.match(review,/方案 1/);
  assert.match(review,/整趟总价 ¥2,120\.00/);
  assert.match(review,/未知项：实时有房/);
  assert.match(review,/回顾不自动读取新价格/);
  assert.match(review,/继续调整这份方案/);
  const status=await render(pending('status','s1',{notice:{title:'套餐资料已变更',text:'山麓套餐版本已更新，请重新计算。',actions:[{label:'调整条件',value:'adjust'}]}}),packages);
  assert.match(status,/套餐资料已变更/);
  assert.match(status,/调整条件/);
});

test('非法负载回退为不渲染（planQuestion 返回 null）',async()=>{
  const {planQuestion}=await import('../src/plan-question.js');
  assert.equal(planQuestion({questions:[{id:'snow-plan-confirm-x',detail:'not-json'}]}).invalid,true);
  assert.equal(planQuestion({questions:[{id:'snow-plan-a-b',detail:'{}'}]}),null);
  assert.equal(planQuestion({questions:[{id:'snow-commit-x',detail:'{}'}]}),null);
});

test('真实入口只传 pending 时仍渲染套餐、传输建议与预填条件',async()=>{
  const html=await render(pending('confirm','c1',{input:{start:'2027-02-06',nights:'7',budget:'20000'},ids:{item:['p1']},suggestions:{item:['连住7晚']},packages:{item:[{...packages[0],splitAllowed:'false'}]}}));
  assert.match(html,/生成方案/);
  assert.match(html,/山麓四晚套餐/);
  assert.match(html,/需连住/);
  assert.match(html,/连住7晚/);
  assert.match(html,/value="2027-02-06"/);
  assert.match(html,/value="20000"/);
});

import {wireStages,brokenEstimate,pendingStage} from './plan-wire-fixtures.mjs';
for(const [stage,payload] of Object.entries(wireStages))test(`${stage} 传输负载实际渲染`,async()=>{
  const html=await render(pendingStage(stage,payload));
  assert.match(html,new RegExp(`data-plan-stage="${stage}"`));
  if(stage==='estimate'){assert.match(html,/value="300"/);assert.match(html,/用户确认前的估算/);}
  if(stage==='results'){assert.match(html,/测试酒店/);assert.match(html,/type="checkbox"/);assert.doesNotMatch(html,/含已接受估算/);}
  if(stage==='review')assert.match(html,/实时有房/);
});
test('线上估算卡按分转元展示所有估算及其依据',async()=>{
  const html=await render(pendingStage('estimate',brokenEstimate));
  assert.match(html,/value="3500"/);assert.match(html,/value="4000"/);assert.match(html,/餐饮估算依据/);assert.match(html,/仅估算共同费用/);
});

test('错误负载显示可恢复错误卡，不回退 JSON 或提供费用确认',async()=>{
  const html=await render(pendingStage('estimate',{estimates:{item:{label:'餐饮',amount:'不是金额'}}}));
  assert.match(html,/方案卡片数据有误/);assert.match(html,/请助理重新生成卡片/);assert.doesNotMatch(html,/接受这些条件并计算|不是金额/);
});
test('持久化快照的 nullable 字段仍可回顾',async()=>{
  const html=await render(pendingStage('review',{plan:{title:'历史方案',reason:null,allocation:null,start:null,nights:null,daily:[{date:'2027-02-06',amount:null,basis:null}],packages:[],unknowns:[]}}));
  assert.match(html,/历史方案/);assert.doesNotMatch(html,/数据有误/);
});

test('pending 创建前的工具校验失败也显示错误卡',()=>{
  const html=server.renderToStaticMarkup(React.createElement(PlanStageFailure,{block:{isError:true,content:[{type:'text',text:'estimates：金额必须为整数分'}]}}));
  assert.match(html,/方案卡片未生成/);assert.match(html,/金额必须为整数分/);
  assert.equal(server.renderToStaticMarkup(React.createElement(PlanStageFailure,{block:{isError:false}})),'');
});


test('套餐提交工具错误不生成独立保存失败卡片',async()=>{
  const {SaveCard}=await load('src/save-card.jsx');
  const html=server.renderToStaticMarkup(React.createElement(SaveCard,{item:{callId:'invalid',done:true,error:'未购买与实付信息冲突，请澄清'}}));
  assert.equal(html,'');
});

test('已存方案展示共同费用与总额加总，缺失分项时提示核对',async()=>{
  const {PlanSavedCard}=await load('src/package-cards.jsx');
  const {normalizePackage}=await import('../src/packages.ts');
  const id='11111111-1111-4111-8111-111111111111';
  const pkg={...normalizePackage({name:'测试套餐'}),id,revision:1,schemaVersion:1,createdAt:'2026-09-25T00:00:00Z',updatedAt:'2026-09-25T00:00:00Z',sessionId:'test'};
  const plan={id,schemaVersion:1,createdAt:pkg.createdAt,sessionId:'test',title:'测试方案',start:'2027-02-06',nights:7,budget:null,total:1036000,paid:null,pending:null,reason:null,allocation:null,estimates:[],items:[{packageId:id,revision:1,nights:7,start:'2027-02-06'}],daily:[{date:'2027-02-06',packageId:id,amount:636000,basis:null}],sharedCosts:[{label:'雪票',amount:400000,basis:'10 张，每张 40000 分'}],unknowns:[],packages:[{id,revision:1,snapshot:pkg}]};
  const html=server.renderToStaticMarkup(React.createElement(PlanSavedCard,{block:{kind:'tool-result',meta:{version:1,status:'saved',plan}}}));
  assert.match(html,/雪票/);assert.match(html,/¥6,360.00 逐晚费用 \+ ¥4,000.00 共同费用 = ¥10,360.00/);assert.match(html,/每张 ¥400.00/);
  const {PlanInteractionCard}=await load('src/package-cards.jsx');
  const saved=data=>server.renderToStaticMarkup(React.createElement(PlanInteractionCard,{data}));
  assert.equal(saved({version:1,status:'saved',plan,interaction:{action:'save'}}),html,'单份保存复用已存方案卡片');
  const batch=saved({status:'save_results',items:[{status:'saved',planId:id,plan},{status:'failed',title:'失败方案',error:'版本变化'}]});
  assert.match(batch,/aria-label="方案已保存"/);assert.match(batch,/总成本组成/);assert.match(batch,/版本变化/);
  const history=saved({interaction:{action:'save',items:[{status:'saved',resultId:id}],card:{results:[{...plan,resultId:id,allocation:[],end:'2027-02-13',checks:[],switches:0,estimated:false,daily:plan.daily.map(d=>({...d,hotel:'测试酒店'}))}]}}});
  assert.match(history,/aria-label="方案已保存"/);assert.match(history,/¥10,360.00/);
  const card={results:[{...plan,resultId:id,allocation:[]},{...plan,resultId:'other',title:'未选择的候选',allocation:[]}]};
  for(const data of [
    {status:'save_results',interaction:{action:'save',card,items:[{status:'saved',resultId:id,planId:id,plan}]}},
    {version:1,status:'saved',plan,interaction:{action:'save',card,items:[{status:'saved',planId:id}]}}
  ]){
    const record=saved(data);
    assert.match(record,/data-readonly="true"/);
    assert.match(record,/可选方案 · 2 份/);
    assert.match(record,/未选择的候选/);
    assert.match(record,/已选 1 份 · 已保存 1 份/);
    assert.match(record,/✓ 已选择/);
    assert.match(record,/aria-label="方案已保存"/);
    assert.ok(record.indexOf('data-readonly')<record.indexOf('aria-label="方案已保存"'));
    assert.doesNotMatch(record,/<input|<textarea|保存所选|取消本次操作/);
  }
  const incomplete=server.renderToStaticMarkup(React.createElement(PlanSavedCard,{block:{kind:'tool-result',meta:{version:1,status:'saved',plan:{...plan,sharedCosts:[]}}}}));
  assert.match(incomplete,/需重新核对/);
  assert.match(html,/旧补款核算口径/);
  const modern={...plan,costVersion:2,daily:plan.daily.map(row=>({...row,base:row.amount-30000,extraPaid:20000,extraPending:10000}))};
  const modernHtml=server.renderToStaticMarkup(React.createElement(PlanSavedCard,{block:{kind:'tool-result',meta:{version:1,status:'saved',plan:modern}}}));
  assert.match(modernHtml,/本次已付补款 ¥200.00.*尚需补款 ¥100.00/);
  assert.doesNotMatch(modernHtml,/旧补款核算口径|<input|<textarea/);

});

test('已确认条件保留费用及套餐快照且不可编辑，调整状态不显示',async()=>{
 const {SaveCard}=await load('src/save-card.jsx');
 const meta={status:'prepared',confirmedByCard:true,conditions:{start:'2027-02-06',nights:7,rooms:1,people:2,skiDays:5,budget:2000000,packageIds:['p1'],fees:[{id:'ski',label:'雪票',quantity:10,unitPrice:57000,source:'estimate',basis:'用户核对价格'}]},packages:[{id:'p1',name:'确认时的套餐名称',revision:3}]};
 const renderItem=item=>server.renderToStaticMarkup(React.createElement(SaveCard,{item}));
 const html=renderItem({kind:'snow_prepare_plan',meta});
 assert.match(html,/确认时的套餐名称/);assert.match(html,/¥570.00/);assert.match(html,/¥5,700.00/);assert.match(html,/¥20,000.00/);assert.doesNotMatch(html,/<input|<button|<textarea/);
 const legacy=renderItem({kind:'snow_prepare_plan',meta:{...meta,confirmedByCard:undefined}});assert.match(legacy,/确认方式未记录/);assert.doesNotMatch(legacy,/✓ 已确认|已接受估算/);
 assert.equal(renderItem({kind:'snow_prepare_plan',meta:{status:'adjusting'}}),'');
 assert.equal(renderItem({kind:'snow_prepare_plan',error:'校验失败',meta}),'');
});

test('交互后保留补充、取消和逐项保存反馈；后台核算不输出卡片',async()=>{
 const {PlanInteractionCard}=await load('src/package-cards.jsx');
 const renderRecord=data=>server.renderToStaticMarkup(React.createElement(PlanInteractionCard,{data}));
 const c={start:'2027-02-06',nights:7,rooms:1,budget:null,packageIds:[],fees:[]};
 const supplement=renderRecord({status:'adjusting',conditions:c,custom:'加上往返交通',interaction:{action:'supplement',stage:'confirm'}});
 assert.match(supplement,/加上往返交通/);assert.match(supplement,/尚未确认/);assert.doesNotMatch(supplement,/<button|<input/);
 assert.match(renderRecord({interaction:{action:'cancel',stage:'results'}}),/已取消本次操作/);
 for(const action of ['cancel','supplement']){
  const html=renderRecord({interaction:{action,stage:'results',custom:action==='supplement'?'请比较雪票费用':null,card:{stage:'results',results:[{title:'完整候选',start:'2027-02-06',nights:7,total:1136000,daily:[{date:'2027-02-06',amount:90858,basis:'套餐及补款'}],sharedCosts:[{label:'雪票',amount:500000,basis:'10张雪票'}]}]}}});
  assert.match(html,/data-readonly="true"/);assert.match(html,/完整候选/);assert.match(html,/¥11,360.00/);assert.match(html,/套餐及补款/);assert.match(html,/雪票/);
  assert.match(html,action==='cancel'?/已取消 · 未保存方案/:/你的补充：请比较雪票费用/);
  assert.doesNotMatch(html,/<input|<textarea|保存所选|发送补充|取消本次操作|选择此方案/);
 }

 assert.match(renderRecord({interaction:{action:'save',stage:'results',items:[{title:'甲',status:'saved'},{title:'乙',status:'failed',error:'版本变化'}]}}),/保存失败.*版本变化/s);
 const {SaveCard}=await load('src/save-card.jsx');
 assert.equal(server.renderToStaticMarkup(React.createElement(SaveCard,{item:{kind:'snow_evaluate',meta:{status:'computed',resultId:'r'}}})), '');
});

test('提问回答记录按题目 ID 展示选择、补充及跳过，不提供编辑控件',async()=>{
 const {QuestionAnswerCard}=await load('src/package-cards.jsx');
 const html=server.renderToStaticMarkup(React.createElement(QuestionAnswerCard,{data:{questions:[{id:'date',header:'出行日期',question:'哪天出发？',options:[{label:'2月6日',description:'春节出发'},{label:'2月13日',description:'节后出发'}]},{id:'people',header:'人数',question:'几人？'}],answers:[{id:'people',selected:[]},{id:'date',selected:['2月6日'],custom:'住7晚'}]}}));
 assert.match(html,/哪天出发？/);assert.match(html,/2月6日/);assert.match(html,/补充：住7晚/);assert.match(html,/已跳过/);assert.doesNotMatch(html,/<input|<textarea/);assert.match(html,/2月13日/);assert.match(html,/节后出发/);assert.match(html,/2月6日，已选择/);assert.match(html,/role="tab"/);assert.match(html,/<button disabled/);
});


test('讨论补充按原卡片回放，不将讨论上下文伪装成已选择方案',async()=>{
 const {PlanInteractionCard}=await load('src/package-cards.jsx');
 for(const action of ['supplement','cancel']){
  const card={stage:'discussion',selected:[0],message:'请核对套餐补差是否已计入实付。',results:[{title:'讨论中的候选',total:389900}]};
  const html=server.renderToStaticMarkup(React.createElement(PlanInteractionCard,{data:{interaction:{stage:'discussion',action,custom:'修正套餐数据',card}}}));
  assert.match(html,/data-plan-stage="discussion"/);assert.match(html,/请核对套餐补差是否已计入实付/);assert.match(html,/修正套餐数据/);
  assert.doesNotMatch(html,/已选择|可选方案|找到合适的搭配|<button|<input/);
  const results=server.renderToStaticMarkup(React.createElement(PlanInteractionCard,{data:{interaction:{stage:'results',action,card:{...card,stage:'results'}}}}));
  assert.doesNotMatch(results,/已选择/);assert.match(results,/未选择/);
 }
});
