import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packageStats,packageCandidates} from '../src/package-explore.js';
const base={id:'a',name:'山湖居',description:'亲子',hotels:['山湖酒店'],resort:'雪场',region:'吉林',nights:3,paid:209700,paidExtra:null,purchaseStatus:'purchased',completeness:'incomplete',usedNights:0,validFrom:'2026-12-01',validTo:'2026-12-06',unavailableDates:[],voided:false};
const filter={start:'2026-12-04',nights:'3',region:'全部目的地',query:'',purchaseStatuses:[],completeness:[]};
const ids=(rows,f=filter,sort='nights')=>packageCandidates(rows,f,sort).map(({record})=>record.id);
test('宿主统计保留未知；筛选按日期、剩余间夜、地区和关键词排除不匹配或相关未知',()=>{
 const stats=packageStats([base,{...base,nights:null,paid:null}]);
 assert.equal(stats.paid,209700);assert.equal(stats.paidUnknown,2);assert.equal(stats.nights,3);assert.equal(stats.nightsUnknown,1);
 assert.deepEqual(ids([base]),['a']);
 for(const patch of [{validFrom:'2026-12-05'},{validTo:'2026-12-05'},{validFrom:null},{validTo:null},{nights:null},{usedNights:null},{usedNights:1},{unavailableDates:null},{unavailableDates:['2026-12-06']}])assert.deepEqual(ids([{...base,...patch}]),[],JSON.stringify(patch));
 assert.deepEqual(ids([{...base,unavailableDates:['2026-12-07']}]),['a']); // 离店日不占住宿夜
 assert.deepEqual(ids([{...base,region:null}],{...filter,region:'吉林'}),[]);
 assert.deepEqual(ids([{...base,region:null}]),['a']);
 for(const query of ['亲子','山湖','酒店','雪场'])assert.deepEqual(ids([base],{...filter,query}),['a']);
 assert.deepEqual(ids([base],{...filter,query:'其他'}),[]);
 assert.deepEqual(ids([base],{...filter,start:'2026-12-05',nights:''}),[]);
 assert.deepEqual(ids([{...base,paid:null,description:null}]),['a']);
 assert.equal(packageStats([]).count,0);
});
test('标签同组取并集、跨组取交集；明确选择未知状态可匹配',()=>{
 const rows=[base,{...base,id:'b',purchaseStatus:'unpurchased',completeness:'complete'},{...base,id:'c',purchaseStatus:'unknown'}];
 assert.deepEqual(ids(rows,{...filter,purchaseStatuses:['purchased','unpurchased']}),['a','b']);
 assert.deepEqual(ids(rows,{...filter,purchaseStatuses:['purchased','unpurchased'],completeness:['complete']}),['b']);
 assert.deepEqual(ids(rows,{...filter,purchaseStatuses:['unknown'],completeness:['incomplete']}),['c']);
 assert.deepEqual(ids(rows),['a','b','c']);
});
test('晚数降序、实付升序，零金额正常、未知末尾，同值按 ID 稳定且不修改输入',()=>{
 const rows=[{...base,id:'c',nights:5,paid:100,paidExtra:999999},{...base,id:'b',paid:0},{...base,id:'a',paid:100},{...base,id:'d',nights:null,paid:null}];
 const unfiltered={...filter,start:'',nights:''};
 assert.deepEqual(ids(rows,unfiltered),['c','a','b','d']);
 assert.deepEqual(ids(rows,unfiltered,'paid'),['b','a','c','d']);
 assert.deepEqual(rows.map(p=>p.id),['c','b','a','d']);
 assert.deepEqual(ids(rows.toReversed(),unfiltered,'paid'),['b','a','c','d']);
});

test('出行方案按套餐 ID 关联，多方案去重、组合筛选与删除后刷新',()=>{
 const rows=[base,{...base,id:'b',revision:2},{...base,id:'c'}];
 const plans=[{items:[{packageId:'a',revision:1},{packageId:'b',revision:1}]},{items:[{packageId:'a',revision:1}]}];
 const matches=(hasPlan,records=plans,patch={})=>packageCandidates(rows,{...filter,hasPlan,...patch},'nights',records).map(({record})=>record.id);
 assert.deepEqual(matches(''),['a','b','c']);
 assert.deepEqual(matches('yes'),['a','b']);
 assert.deepEqual(matches('no'),['c']);
 assert.deepEqual(matches('yes',plans,{query:'不存在'}),[]);
 assert.deepEqual(matches('no',[]),['a','b','c']);
 assert.deepEqual(matches('yes',[]),[]);
 assert.deepEqual(matches('no',plans.slice(1)),['b','c']);
});
