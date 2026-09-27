import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterPlans,sortPlans,planRegions,refundPolicies,tripDays} from '../src/plan-filter.js';
test('出行区间须被方案完整包含，首尾可相等，支持跨月跨年与闰日',()=>{
  const plans=[
    {id:1,start:'2027-12-30',nights:4,tracking:{booking:'confirmed'}},
    {id:2,start:'2028-01-01',nights:1},
    {id:3,start:'2028-02-28',nights:2},
    {id:4,start:null,nights:4},{id:5,start:'2027-12-30',nights:null},
  ];
  const filter={booking:[],refund:[],refundPolicy:[],days:[],start:'',end:''};
  const ids=(start,end,patch={})=>filterPlans(plans,{...filter,start,end,...patch}).map(plan=>plan.id);
  assert.deepEqual(ids('2028-01-01','2028-01-02'),[1,2]);
  assert.deepEqual(ids('2027-12-30','2028-01-03'),[1]);
  assert.deepEqual(ids('2028-01-03','2028-01-03'),[1]);
  assert.deepEqual(ids('2027-12-29','2027-12-31'),[]);
  assert.deepEqual(ids('2028-01-02','2028-01-04'),[]);
  assert.deepEqual(ids('2028-02-29','2028-03-01'),[3]);
  assert.deepEqual(ids('2028-01-01','2028-01-02',{days:[5],booking:['confirmed'],refund:['']}),[1]);
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
  const filter={booking:[],refund:[],refundPolicy:[]};
  const ids=patch=>filterPlans(plans,{...filter,...patch}).map(plan=>plan.id);
  assert.deepEqual(ids({}),[1,2,3,4,5]);
  assert.deepEqual(ids({booking:['confirmed']}),[1,3]);
  assert.deepEqual(ids({booking:['confirmed','unreserved'],refund:['refundable']}),[1,2,5]);
  assert.deepEqual(ids({booking:['confirmed'],refund:['refundable'],refundPolicy:['未预约可退']}),[]);
  assert.deepEqual(ids({refundPolicy:['未预约可退']}),[2,5]);
  assert.deepEqual(ids({booking:[''],refund:['']}),[4]);
  assert.deepEqual(refundPolicies(plans),['2月4日00:00前可退','未预约可退']);
  assert.equal(plans.length,5);
});
test('出行天数按全部方案晚数加一去重排序，支持多选、组合和重置',()=>{
  const plans=[{id:1,nights:10,tracking:{booking:'confirmed'}},{id:2,nights:2},{id:3,nights:10},{id:4,nights:null},{id:5}];
  const filter={booking:[],refund:[],refundPolicy:[],days:[]};
  const ids=patch=>filterPlans(plans,{...filter,...patch}).map(plan=>plan.id);
  assert.deepEqual(tripDays(plans),[3,11]);
  assert.deepEqual(tripDays([]),[]);
  assert.deepEqual(tripDays([{nights:null},{}]),[]);
  assert.deepEqual(ids({days:[11]}),[1,3]);
  assert.deepEqual(ids({days:[3,11]}),[1,2,3]);
  assert.deepEqual(ids({days:[11],booking:['confirmed'],refund:['']}),[1]);
  assert.deepEqual(ids({days:[3],booking:['confirmed'],refund:['']}),[]);
  assert.deepEqual(ids({days:[]}),[1,2,3,4,5]);
});

test('方案标签同组取并集、跨组取交集，任一组不选不限，未知独立匹配',()=>{
  const plans=['confirmed','unreserved',null].flatMap(booking=>['refundable','nonrefundable',null].map(refund=>({tracking:{booking,refund}})));
  const filter={booking:[],refund:[],refundPolicy:[]};
  const ids=patch=>filterPlans(plans,{...filter,...patch}).map(plan=>plans.indexOf(plan));
  for(const [id,plan] of plans.entries())assert.deepEqual(ids({booking:[plan.tracking.booking??''],refund:[plan.tracking.refund??'']}),[id]);
  assert.deepEqual(ids({booking:['confirmed','unreserved'],refund:['refundable','nonrefundable']}),[0,1,3,4]);
  assert.deepEqual(ids({booking:['confirmed','unreserved']}),[0,1,2,3,4,5]);
  assert.deepEqual(ids({refund:['refundable']}),[0,3,6]);
  assert.deepEqual(ids({booking:['']}),[6,7,8]);
  assert.deepEqual(ids({refund:['']}),[2,5,8]);
  assert.deepEqual(filterPlans(plans,filter),plans);
});

test('方案天数和总成本独立升降序，缺失值末尾，同值稳定且不改变源列表',()=>{
  const plans=[{id:'a',nights:7,total:100},{id:'b',nights:2,total:0},{id:'c',nights:7,total:200},{id:'d',nights:null,total:null},{id:'e'}];
  const ids=(key,direction)=>sortPlans(plans,key,direction).map(plan=>plan.id);
  assert.deepEqual(ids('nights','desc'),['a','c','b','d','e']);
  assert.deepEqual(ids('nights','asc'),['b','a','c','d','e']);
  assert.deepEqual(ids('total','desc'),['c','a','b','d','e']);
  assert.deepEqual(ids('total','asc'),['b','a','c','d','e']);
  assert.deepEqual(plans.map(plan=>plan.id),['a','b','c','d','e']);
  assert.deepEqual(sortPlans([]),[]);
});

test('目的地来自所有方案快照，去重排序、多目的地任一匹配、组合筛选和重置',()=>{
  const packages=(...regions)=>regions.map(region=>({snapshot:{region}}));
  const plans=[{id:1,packages:packages('吉林','黑龙江'),nights:7},{id:2,packages:packages('吉林')},{id:3,packages:packages(null)},{id:4}];
  const filter={booking:[],refund:[],refundPolicy:[],regions:[]};
  const ids=patch=>filterPlans(plans,{...filter,...patch}).map(plan=>plan.id);
  assert.deepEqual(planRegions(plans),['黑龙江','吉林']);
  assert.deepEqual(planRegions([]),[]);
  assert.deepEqual(ids({regions:['黑龙江']}),[1]);
  assert.deepEqual(ids({regions:['吉林']}),[1,2]);
  assert.deepEqual(ids({regions:['吉林','黑龙江']}),[1,2]);
  assert.deepEqual(ids({regions:['吉林'],days:[8]}),[1]);
  assert.deepEqual(ids({regions:['新疆']}),[]);
  assert.deepEqual(ids({regions:[]}),[1,2,3,4]);
});
