import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePackage,packageRecord,benefitSummary} from '../src/packages.ts';
test('权益保留数量口径和未知，不包含不要求数量；旧记录默认未知',()=>{
 const p=normalizePackage({name:'住滑套餐',skiIncluded:true,skiTickets:2,skiBasis:'night',breakfastIncluded:true,breakfastPeople:2,breakfastBasis:'day',spaIncluded:false,splitAllowed:true,splitRule:'每次至少住2晚'});
 assert.match(benefitSummary(p)[0].text,/2张.*每晚/);assert.match(benefitSummary(p)[1].text,/2人.*每日/);assert.equal(benefitSummary(p)[2].text,'不包含');assert.match(benefitSummary(p)[4].text,/可拆分.*至少住2晚/);
 assert.ok(!p.unknowns.includes('汤泉人数'));assert.ok(!p.unknowns.includes('汤泉次数'));assert.ok(!p.unknowns.includes('雪票说明'));
 const unknown=normalizePackage({name:'测试',skiIncluded:true});assert.ok(unknown.unknowns.includes('雪票张数'));assert.ok(unknown.unknowns.includes('雪票发放口径'));
 assert.throws(()=>normalizePackage({name:'测试',spaIncluded:false,spaPeople:2}));assert.throws(()=>normalizePackage({name:'测试',skiTickets:1.5}));assert.throws(()=>normalizePackage({name:'测试',breakfastPeople:0}));
 assert.ok(normalizePackage({name:'测试',skiIncluded:true,skiBasis:'other'}).unknowns.includes('雪票说明'));
 const raw={...p,id:crypto.randomUUID(),revision:1,schemaVersion:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sessionId:'test'};
 for(const key of ['skiIncluded','skiTickets','skiBasis','skiRule','breakfastIncluded','breakfastPeople','breakfastBasis','breakfastRule','spaIncluded','spaPeople','spaVisits','spaBasis','spaRule','splitAllowed'])delete raw[key];
 const legacy=packageRecord.parse(raw);assert.equal(legacy.skiIncluded,null);assert.equal(legacy.splitAllowed,null);assert.ok(legacy.unknowns.includes('是否含雪票'));assert.equal(legacy.splitRule,'每次至少住2晚');
});

test('拆分规则可选，已有记录读取时也移除对应待补全提示',()=>{
 const p=normalizePackage({name:'可拆分套餐',splitAllowed:true});
 assert.ok(!p.unknowns.includes('拆分规则'));
 assert.equal(benefitSummary(p)[4].text,'可拆分');
 const record=packageRecord.parse({...p,unknowns:[...p.unknowns,'拆分规则'],id:crypto.randomUUID(),revision:1,schemaVersion:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sessionId:'test'});
 assert.ok(!record.unknowns.includes('拆分规则'));
 assert.ok(normalizePackage({name:'未知套餐'}).unknowns.includes('是否可拆分'));
});

test('其他权益逐行展示，区分未提供和无，不要求补全',()=>{
 for(const [value,expected] of [[null,'未提供'],[[],'无'],[['晚餐券2张','接送1次'],'晚餐券2张\n接送1次']]){
  const p=normalizePackage({name:'测试',otherBenefits:value});
  assert.equal(benefitSummary(p)[3].text,expected);
  assert.ok(!p.unknowns.includes('其他权益'));
 }
 assert.equal(normalizePackage({name:'旧套餐'}).otherBenefits,null);
});
