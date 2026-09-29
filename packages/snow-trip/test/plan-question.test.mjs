import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planQuestion,planQuestionItem} from '../src/shared/plan-question.ts';

const detail=(stage,key,extra={})=>JSON.stringify({stage,key,...extra});
const pendingOf=(stage,key,extra={})=>({questions:[{id:`snow-plan-${stage}-${key}`,question:'请确认',detail:detail(stage,key,extra)}]});

test('方案问题卡识别 snow-plan 前缀并校验 id 与负载自洽',()=>{
  const confirm=pendingOf('confirm','c1',{input:{start:'2026-12-11'},ids:['a'],suggestions:{nights:3}});
  const parsed=planQuestion(confirm);
  assert.ok(parsed);assert.equal(parsed.stage,'confirm');assert.equal(parsed.callId,'snow-plan-confirm-c1');
  assert.deepEqual(parsed.ids,['a']);assert.equal(parsed.suggestions.nights,3);
  // id 与负载 stage/key 不一致 → 回退 null（伪造卡不渲染）。
  const forged={questions:[{id:'snow-plan-confirm-other',question:'x',detail:detail('confirm','c1')}]};
  assert.equal(planQuestion(forged),null);
  // 非 snow-plan 前缀是普通问题。
  assert.equal(planQuestion({questions:[{id:'snow-commit-x',question:'y',detail:'{}'}]}),null);
  // 非法 JSON 与缺 stage 回退。
  assert.equal(planQuestion({questions:[{id:'snow-plan-x-y',question:'z',detail:'not-json'}]}),null);
  assert.equal(planQuestion({questions:[{id:'snow-plan-x-y',question:'z',detail:'{}'}]}),null);
  // 多问题请求不作为方案卡。
  assert.equal(planQuestion({questions:[{id:'snow-plan-confirm-a',detail:detail('confirm','a')},{id:'b',detail:'{}'}]}),null);
  // 全阶段负载可解析。
  for(const [stage,extra] of [['estimate',{start:'2026-12-11',nights:3,estimates:[{label:'交通',amount:30000,basis:'示例估算'}],suggested:{start:true}}],['results',{results:[{title:'搭配',total:212000,daily:[{date:'2026-12-11',amount:100,basis:'分摊'}]}],selected:[0]}],['discussion',{results:[],selected:[],message:'少换酒店'}],['review',{plan:{title:'方案 1',daily:[],packages:[]}}],['status',{notice:{title:'套餐已变更',text:'请重新计算',actions:[{label:'调整条件',value:'adjust'}]}}]]){
    const item=planQuestion(pendingOf(stage,'k1',extra));
    assert.ok(item,stage);assert.equal(item.stage,stage);
  }
});

test('planQuestionItem 构造服务端请求项，不携带通用选项（按钮由卡片渲染）',()=>{
  const item=planQuestionItem('results','r1',{question:'请选择',results:[{title:'搭配'}]});
  assert.equal(item.id,'snow-plan-results-r1');
  assert.deepEqual(item.options,undefined);assert.equal(item.multiSelect,undefined);
  const parsed=planQuestion({questions:[item]});
  assert.ok(parsed);assert.equal(parsed.stage,'results');
  const plain=planQuestionItem('confirm','c2',{question:'x'});
  assert.equal('multiSelect' in plain,false);assert.equal('options' in plain,false);
});

// 与线上传输形状一致，使用合成套餐避免把私人数据写入测试。
const transportedDetail={input:{start:'2027-02-06',nights:'7',budget:'20000'},ids:{item:['p1']},suggestions:{item:['连住7晚']},packages:{item:[{id:'p1',name:'测试连住套餐',purchaseStatus:'purchased',nights:'7',splitAllowed:'false',completeness:'complete'}]}};
test('传输后的确认负载仍识别为方案卡，保留列表和 false',()=>{
  const parsed=planQuestion(pendingOf('confirm','c1',transportedDetail));
  assert.ok(parsed,'不能回退到通用 JSON 提问框');
  assert.deepEqual(parsed.ids,['p1']);
  assert.deepEqual(parsed.suggestions,['连住7晚']);
  assert.equal(parsed.packages[0].splitAllowed,false);
  assert.equal(parsed.packages[0].nights,7);
  assert.deepEqual(planQuestion(pendingOf('confirm','single',{ids:{item:'p1'}})).ids,['p1']);
  assert.equal(planQuestion(pendingOf('confirm','bad',{packages:[{id:'p1',splitAllowed:'maybe'}]})).invalid,true);
});

import {wireStages,brokenEstimate,pendingStage} from './plan-wire-fixtures.mjs';
for(const [stage,payload] of Object.entries(wireStages))test(`${stage} 阶段完整解析传输负载`,()=>{
  const parsed=planQuestion(pendingStage(stage,payload));
  assert.ok(parsed,`${stage} 不应退回通用问题框`);
  if(stage==='estimate'){assert.equal(parsed.nights,7);assert.equal(parsed.suggested.start,false);assert.equal(parsed.estimates[0].amount,30000);}
  if(stage==='results'){assert.equal(parsed.results[0].estimated,false);assert.equal(parsed.results[0].daily[0].amount,30000);assert.deepEqual(parsed.selected,[0]);}
  if(stage==='review'){assert.deepEqual(parsed.plan.unknowns,['实时有房']);assert.equal(parsed.plan.packages.length,1);}
});
test('线上估算错位字段完整保留费用和依据',()=>{
  const parsed=planQuestion(pendingStage('estimate',brokenEstimate));
  assert.ok(parsed);
  assert.deepEqual(parsed.estimates.map(e=>[e.label,e.amount,e.basis]),[['餐饮',350000,'餐饮估算依据'],['雪票',400000,'雪票估算依据']]);
  assert.equal(parsed.scope,'仅估算共同费用');
});
