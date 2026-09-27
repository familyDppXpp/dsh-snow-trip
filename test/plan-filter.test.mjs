import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterPlans,planStatuses,refundPolicies,tripDays} from '../src/plan-filter.js';
test('出行区间须被方案完整包含，首尾可相等，支持跨月跨年与闰日',()=>{
  const plans=[
    {id:1,start:'2027-12-30',nights:4,tracking:{booking:'confirmed'}},
    {id:2,start:'2028-01-01',nights:1},
    {id:3,start:'2028-02-28',nights:2},
    {id:4,start:null,nights:4},{id:5,start:'2027-12-30',nights:null},
  ];
  const filter={statuses:[],refundPolicy:[],days:[],start:'',end:''};
  const ids=(start,end,patch={})=>filterPlans(plans,{...filter,start,end,...patch}).map(plan=>plan.id);
  assert.deepEqual(ids('2028-01-01','2028-01-02'),[1,2]);
  assert.deepEqual(ids('2027-12-30','2028-01-03'),[1]);
  assert.deepEqual(ids('2028-01-03','2028-01-03'),[1]);
  assert.deepEqual(ids('2027-12-29','2027-12-31'),[]);
  assert.deepEqual(ids('2028-01-02','2028-01-04'),[]);
  assert.deepEqual(ids('2028-02-29','2028-03-01'),[3]);
  assert.deepEqual(ids('2028-01-01','2028-01-02',{days:[5],statuses:['confirmed:']}),[1]);
  assert.deepEqual(ids('2028-01-03','2028-01-01'),[]);
  assert.deepEqual(ids('2028-01-01',''),[]);
  assert.deepEqual(ids('','2028-01-01'),[]);
  assert.deepEqual(ids('2028-02-30','2028-03-01'),[]);
  assert.deepEqual(ids('',''),[1,2,3,4,5]);
});
test('方案按状态与策略组合筛选，策略从全部方案去重，旧记录保留未知',()=>{
  const plans=[
    {id:1,tracking:{booking:'confirmed',refund:'refundable',refundPolicy:'2月4日00:00前可退'}},
    {id:2,tracking:{booking:'unreserved',refund:'refundable',refundPolicy:'未预约可退'}},
    {id:3,tracking:{booking:'confirmed',refund:'nonrefundable',refundPolicy:null}},
    {id:4},
    {id:5,tracking:{booking:'unreserved',refund:'refundable',refundPolicy:'未预约可退'}},
  ];
  const filter={statuses:[],refundPolicy:[]};
  const ids=patch=>filterPlans(plans,{...filter,...patch}).map(plan=>plan.id);
  assert.deepEqual(ids({}),[1,2,3,4,5]);
  assert.deepEqual(ids({statuses:['confirmed:refundable','confirmed:nonrefundable']}),[1,3]);
  assert.deepEqual(ids({statuses:['confirmed:refundable','unreserved:refundable']}),[1,2,5]);
  assert.deepEqual(ids({statuses:['confirmed:refundable'],refundPolicy:['未预约可退']}),[]);
  assert.deepEqual(ids({refundPolicy:['未预约可退']}),[2,5]);
  assert.deepEqual(ids({statuses:[':']}),[4]);
  assert.deepEqual(refundPolicies(plans),['2月4日00:00前可退','未预约可退']);
  assert.equal(plans.length,5);
});
test('出行天数按全部方案晚数加一去重排序，支持多选、组合和重置',()=>{
  const plans=[{id:1,nights:10,tracking:{booking:'confirmed'}},{id:2,nights:2},{id:3,nights:10},{id:4,nights:null},{id:5}];
  const filter={statuses:[],refundPolicy:[],days:[]};
  const ids=patch=>filterPlans(plans,{...filter,...patch}).map(plan=>plan.id);
  assert.deepEqual(tripDays(plans),[3,11]);
  assert.deepEqual(tripDays([]),[]);
  assert.deepEqual(tripDays([{nights:null},{}]),[]);
  assert.deepEqual(ids({days:[11]}),[1,3]);
  assert.deepEqual(ids({days:[3,11]}),[1,2,3]);
  assert.deepEqual(ids({days:[11],statuses:['confirmed:']}),[1]);
  assert.deepEqual(ids({days:[3],statuses:['confirmed:']}),[]);
  assert.deepEqual(ids({days:[]}),[1,2,3,4,5]);
});

test('预约与退改枚举为 3 × 3，多选按完整配对匹配，不产生交叉组合',()=>{
  assert.equal(planStatuses.length,9);
  assert.equal(new Set(planStatuses.map(([key])=>key)).size,9);
  const plans=planStatuses.map(([key],id)=>{
    const [booking,refund]=key.split(':');
    return {id,tracking:{booking:booking||null,refund:refund||null}};
  });
  const filter={statuses:[],refundPolicy:[]};
  for(const [id,[status]] of planStatuses.entries()){
    assert.deepEqual(filterPlans(plans,{...filter,statuses:[status]}).map(plan=>plan.id),[id]);
  }
  assert.deepEqual(filterPlans(plans,{...filter,statuses:['confirmed:refundable','unreserved:nonrefundable']}).map(plan=>plan.id),[0,4]);
  assert.deepEqual(filterPlans(plans,filter),plans);
});
