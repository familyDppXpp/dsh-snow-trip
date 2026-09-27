import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePackage} from '../src/packages.ts';
const entry={id:'weekend',purpose:'周末补款',scope:'date',date:'2027-02-04',rooms:1,paid:20000,total:40000,settled:false,basis:'用户确认本晚应补400元，已付200元'};
test('补款归属与结清情况不明时资料不完整，明细总额必须与已付总额一致',()=>{
  assert.ok(normalizePackage({name:'测试',paidExtra:20000}).unknowns.includes('补款明细'));
  for(const patch of [{purpose:null},{scope:null},{date:null},{rooms:null},{paid:null},{settled:null},{total:null},{basis:null}]){
    assert.ok(normalizePackage({name:'测试',paidExtra:20000,extraPayments:[{...entry,...patch}]}).unknowns.some(v=>v.includes('补款明细')));
  }
  assert.ok(!normalizePackage({name:'测试',paidExtra:20000,extraPayments:[entry]}).unknowns.some(v=>v.includes('补款明细')));
  assert.ok(normalizePackage({name:'测试',paidExtra:30000,extraPayments:[entry]}).unknowns.some(v=>v.includes('合计')));
  assert.ok(!normalizePackage({name:'测试',paidExtra:0}).unknowns.includes('补款明细'));
  assert.ok(!normalizePackage({name:'测试',paidExtra:20000,extraPayments:[{...entry,settled:true,total:30000}]}).unknowns.some(v=>v.includes('补款明细')));
});

import {calculate} from '../lib/types/planning.js';
const pkgId='11111111-1111-4111-8111-111111111111';
const basic={name:'测试套餐',description:'说明',hotels:['酒店'],roomType:'双床',resort:'雪场',region:'吉林',nights:4,purchaseStatus:'purchased',purchasePlatform:'平台',quote:160000,paid:120000,paidExtra:0,usedNights:0,voided:false,validFrom:'2027-01-01',validTo:'2027-03-31',splitAllowed:true,skiIncluded:false,breakfastIncluded:false,spaIncluded:false,surchargeRules:['指定日期补款'],unavailableDates:[]};
function compute(payments,daily,total,patch={},rooms=1) {
 const pkg={...normalizePackage({...basic,paidExtra:payments.reduce((n,r)=>n+r.paid,0),extraPayments:payments,...patch}),id:pkgId,revision:1,schemaVersion:1,createdAt:'2026-09-27T00:00:00Z',updatedAt:'2026-09-27T00:00:00Z',sessionId:'test'};
 const planning={conditions:{start:'2027-02-04',nights:2,rooms,packageIds:[pkgId],fees:[],budget:null},id:crypto.randomUUID(),sessionId:'test'};
 return calculate(planning,[{packageId:pkgId,revision:1,start:'2027-02-04',nights:2}],[pkg],{daily:daily.map((row,i)=>({date:`2027-02-0${4+i}`,packageId:pkgId,basis:'依据',...row})),coverage:[],total},'方案','说明').plan;
}
test('已付、未付分开归属，不重复计费；明确结清按实际金额；整包补款才分摊',()=>{
 const charges=[{charges:[{purpose:entry.purpose,amount:40000,extraPaymentId:entry.id}]},{charges:[]}];
 let plan=compute([entry],charges,100000);
 assert.equal(plan.costVersion,2);assert.equal(plan.daily[0].extraPaid,20000);assert.equal(plan.daily[0].extraPending,20000);
 const settled={...entry,paid:30000,settled:true};
 plan=compute([settled],[{charges:[{purpose:entry.purpose,amount:30000,extraPaymentId:entry.id}]},{charges:[]}],90000);
 assert.equal(plan.daily[0].extraPending,0);
 assert.throws(()=>compute([settled],charges,100000),/补款金额/);
 assert.throws(()=>compute([entry],[{surcharge:40000},{surcharge:0}],100000),/明细/);
 assert.throws(()=>compute([entry],[{charges:[]},{charges:[]}],60000),/遗漏/);
 assert.throws(()=>compute([entry],[{charges:[...charges[0].charges,...charges[0].charges]},{charges:[]}],140000),/重复/);
 assert.throws(()=>compute([entry],[{charges:[]},{charges:charges[0].charges}],100000),/遗漏|日期/);
 const otherDate={...entry,date:'2027-02-06'};
 assert.equal(compute([otherDate],[{charges:[]},{charges:[]}],60000).total,60000);
 const whole={...entry,scope:'package',date:null,rooms:null,paid:20000,total:null,settled:true};
 const wholeCharge={charges:[{purpose:entry.purpose,amount:5000,extraPaymentId:entry.id}]};
 assert.equal(compute([whole],[wholeCharge,wholeCharge],70000).total,70000);
 assert.throws(()=>compute([entry],charges,100000,{extraPayments:null}),/资料不完整/);
});

test('部分房间已付只抵对应房间，剩余房间费用单独计入且不允许覆盖重叠',()=>{
 const paidCharge={purpose:entry.purpose,amount:40000,extraPaymentId:entry.id};
 const rest={purpose:entry.purpose,amount:40000,rooms:1};
 const plan=compute([entry],[{charges:[paidCharge,rest]},{charges:[]}],200000,{},2);
 assert.equal(plan.daily[0].extraPaid,20000);assert.equal(plan.daily[0].extraPending,60000);
 assert.throws(()=>compute([entry],[{charges:[paidCharge,{...rest,rooms:2}]},{charges:[]}],200000,{},2),/重复|房间数/);
 const odd={...entry,scope:'package',date:null,rooms:null,paid:10001,total:10003,settled:false};
 const first={purpose:entry.purpose,extraPaymentId:entry.id,amount:2502};
 const second={...first,amount:2500};
 const split=compute([odd],[{charges:[first]},{charges:[second]}],65002);
 assert.equal(split.daily.reduce((n,r)=>n+r.extraPaid,0),5001);
 assert.equal(split.daily.reduce((n,r)=>n+r.extraPending,0),1);
});
