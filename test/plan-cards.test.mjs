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
const load=async()=>{
  // external react：组件用宿主 React 渲染（与生产 bundle 一致）；经 vm require 注入宿主 React。
  const bundle=await build({entryPoints:['src/plan-question-card.jsx'],bundle:true,write:false,platform:'node',format:'cjs',external:['react','react/jsx-runtime'],loader:{'.css':'text'}});
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
const {PlanQuestionCard}=await load();
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
  assert.match(html,/示例估算，可修改/);
  assert.match(html,/接受这些条件并计算/);
  assert.match(html,/住宿按入住日计/);
});

test('结果卡展示勾选、每日费用表、分摊依据与统一操作栏',async()=>{
  const detail={results:[
    {title:'搭配一',start:'2026-12-11',end:'2026-12-14',nights:3,total:212000,paid:60000,pending:152000,budget:220000,estimated:true,daily:[{date:'2026-12-11',hotel:'山麓酒店',amount:30000,basis:'已购 1200 元 4 晚，按 3 晚分摊 900 元'}],sharedCosts:[{label:'整趟往返交通',amount:30000,basis:'用户接受'}],allocation:['山麓套餐：整单已付 ¥1,200.00，共 4 晚，本次使用 3 晚，按间夜分摊。'],checks:['脚本执行于受限沙箱'],reason:'全程住同一家，行李不用搬',switches:0},
    {title:'搭配二',total:252000,paid:60000,pending:192000,budget:220000,daily:[],reason:'拼两份套餐',switches:1},
  ],selected:[0]};
  const html=await render(pending('results','r1',detail),packages);
  assert.match(html,/找到合适的搭配/);
  assert.match(html,/优先推荐/);
  assert.match(html,/备选 2/);
  assert.match(html,/¥2,120\.00/);
  assert.match(html,/按间夜分摊/);
  assert.match(html,/整趟往返交通 ¥300\.00/);
  assert.match(html,/单独计一次，不重复分到每天/);
  assert.match(html,/全程住同一家/);
  assert.match(html,/本次已付成本 ¥600\.00/);
  assert.match(html,/预计待付 ¥1,520\.00/);
  assert.match(html,/预算内/);
  assert.match(html,/已选择 1 份/);
  assert.match(html,/继续讨论/);
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
  assert.equal(planQuestion({questions:[{id:'snow-plan-confirm-x',detail:'not-json'}]}),null);
  assert.equal(planQuestion({questions:[{id:'snow-plan-a-b',detail:'{}'}]}),null);
  assert.equal(planQuestion({questions:[{id:'snow-commit-x',detail:'{}'}]}),null);
});
