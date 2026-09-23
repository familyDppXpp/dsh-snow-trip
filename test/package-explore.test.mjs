import {test} from 'node:test';
import assert from 'node:assert/strict';
import {packageStats,packageCandidates} from '../src/package-explore.js';
test('宿主套餐统计使用分，未知不当作零；不完整候选保留并提示日期与预算限制',()=>{
 const a={name:'山湖居',description:null,hotels:['山湖居'],resort:null,region:null,nights:3,paid:209700,paidExtra:null,purchaseStatus:'purchased',usedNights:null,validFrom:'2026-03-01',validTo:'2028-10-01',unavailableDates:null,voided:null};
 const b={...a,name:'未购买资料',nights:null,paid:null};
 const stats=packageStats([a,b]);
 assert.equal(stats.paid,209700);assert.equal(stats.paidUnknown,2);assert.equal(stats.nights,3);assert.equal(stats.nightsUnknown,1);assert.equal(stats.regionsUnknown,2);
 const filter={start:'2026-12-04',nights:'',region:'吉林',budget:'0',query:''};
 const rows=packageCandidates([a,b],filter,'nights');assert.equal(rows.length,2);assert.match(rows[1].notes.join(' '),/晚数待确认/);assert.match(rows[0].notes.join(' '),/尚不能确认符合预算/);
 assert.equal(packageCandidates([a,b],{...filter,query:'找不到'},'source').length,0);
 assert.match(packageCandidates([a],{...filter,start:'2029-01-01'},'source')[0].notes.join(' '),/超出有效期/);
 assert.equal(packageStats([]).count,0);
});
