import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planQuestion,planQuestionItem} from '../src/plan-question.js';

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

test('planQuestionItem 构造服务端请求项，id/键/负载回环一致',()=>{
  const item=planQuestionItem('results','r1',{question:'请选择',results:[{title:'搭配'}]},[{label:'继续讨论'},{label:'保存所选'}],'雪季方案 · results',true);
  assert.equal(item.id,'snow-plan-results-r1');
  assert.equal(item.header,'雪季方案 · results');
  assert.equal(item.multiSelect,true);
  assert.deepEqual(item.options.map(o=>o.label),['继续讨论','保存所选']);
  const parsed=planQuestion({questions:[item]});
  assert.ok(parsed);assert.equal(parsed.stage,'results');
  // 不传 options 时无 multiSelect 键。
  const plain=planQuestionItem('confirm','c2',{question:'x'});
  assert.equal('multiSelect' in plain,false);assert.equal('options' in plain,false);
});
