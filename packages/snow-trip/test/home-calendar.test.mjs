import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calendarDay,undatedRecords,planDateRanges,filterCalendarDay,seasonCalendar,localDay,validMonthRange} from '../src/client/home-calendar.js';

const a={id:'a',validFrom:'2026-12-30',validTo:'2027-01-02',unavailableDates:['2027-01-01'],nights:3,usedNights:0,voided:false};
const b={id:'b',start:'2026-12-31',nights:2,items:[]};
const c={...a,id:'c',unavailableDates:null};
const ids=rows=>rows.map(row=>row.id);
test('首页 A/B/C 跨年：单晚、离店日、禁用日、待确认与按 ID 去重',()=>{
  for(const [day,packages,plans,pending] of [
    ['2026-12-29',[],[],[]],['2026-12-30',['a'],[],['c']],
    ['2026-12-31',['a'],['b'],['c']],['2027-01-01',[],['b'],['c']],
    ['2027-01-02',['a'],['b'],['c']],['2027-01-03',[],[],[]],
  ]){
    const result=calendarDay([a,a,c],[b,b],day);
    assert.deepEqual(ids(result.packages),packages,day);
    assert.deepEqual(ids(result.plans),plans,day);
    assert.deepEqual(ids(result.pendingPackages),pending,day);
  }
});
test('购买与未知使用量不排除日期，明确作废/耗尽排除；null 不等于空数组',()=>{
  for(const purchaseStatus of ['purchased','unpurchased','unknown']){
    const record={...a,purchaseStatus,usedNights:null,voided:null,splitAllowed:null,unavailableDates:[]};
    assert.equal(calendarDay([record],[],'2027-01-01').packages.length,1);
  }
  for(const record of [{...a,voided:true},{...a,usedNights:3},{...a,nights:0}])assert.equal(calendarDay([record],[],'2026-12-31').packages.length,0);
  assert.equal(calendarDay([c],[],'2026-12-31').packages.length,0);
});
test('缺端只在已知边界内待确认，无日期集中展示且保留详情；禁用日优先',()=>{
  const partial={...c,validTo:null},undated={...c,id:'undated',validFrom:null,validTo:null};
  assert.equal(calendarDay([partial,undated],[],'2026-12-29').pendingPackages.length,0);
  assert.deepEqual(ids(calendarDay([partial,undated],[],'2027-01-03').pendingPackages),['c']);
  assert.equal(calendarDay([{...partial,unavailableDates:['2027-01-03']}],[],'2027-01-03').pendingPackages.length,0);
  assert.deepEqual(ids(undatedRecords([undated,undated,{...undated,id:'void',voided:true}],[]).packages),['undated']);
  assert.deepEqual(ids(undatedRecords([], [{id:'missing',items:[]},{id:'missing',items:[]}]).plans),['missing']);
});
test('总日期优先、合法分段并集不填空档，跨月与闰日',()=>{
  const segments={id:'segments',start:null,nights:null,items:[{start:'2028-02-28',nights:2},{start:'2028-03-05',nights:1},{start:'2028-02-30',nights:3},{start:'2028-03-02',nights:-1}]};
  assert.equal(planDateRanges(segments).length,2);
  for(const day of ['2028-02-28','2028-02-29','2028-03-01','2028-03-05','2028-03-06'])assert.equal(calendarDay([], [segments,segments],day).plans.length,1,day);
  for(const day of ['2028-03-02','2028-03-03','2028-03-04'])assert.equal(calendarDay([], [segments],day).plans.length,0,day);
  assert.deepEqual(planDateRanges({...segments,start:'2028-04-01',nights:1}),[['2028-04-01','2028-04-02']]);
  assert.deepEqual(planDateRanges({...segments,start:'2028-04-01'}),planDateRanges(segments));
});

test('真实宿主保存、修改、级联删除后的读取重新聚合，方案快照保持历史日期',async()=>{
  const {Context}=await import('@deepseek-ai/cordis');
  const {default:Storage}=await import('@deepseek-ai/dsh-storage');
  const StorageJson=await import('@deepseek-ai/dsh-storage-json'),StorageDomain=await import('@deepseek-ai/dsh-storage-domain');
  const {SnowTrip}=await import('../lib/server/service.js'),{normalizePackage}=await import('../src/shared/packages.ts');
  const {mkdtemp,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os');
  const root=await mkdtemp(`${tmpdir()}/snow-home-data-`),ctx=new Context();
  const owner=ctx.plugin({async apply(inner){await inner.plugin(Storage);await inner.plugin(StorageJson,{root});await inner.plugin(StorageDomain,{backend:'json'});inner.provide('workspaceRegistry',{archiveSession:async()=>{}});await inner.plugin(SnowTrip);}});
  try{
    await owner;
    const {id:fixtureId,...input}=a,now=new Date().toISOString();
    let pkg={...normalizePackage(input),id:crypto.randomUUID(),revision:1,schemaVersion:1,createdAt:now,updatedAt:now,sessionId:'home-check'};
    const read=async day=>calendarDay(await ctx.snowTrip.listPackages(),await ctx.snowTrip.listPlans(),day);
    assert.equal((await read('2026-12-31')).packages.length,0);
    await ctx.snowTrip.savePackage(pkg);assert.equal((await read('2026-12-31')).packages.length,1);
    const plan={...b,id:crypto.randomUUID(),schemaVersion:1,createdAt:now,sessionId:pkg.sessionId,title:'跨年行程',budget:null,total:null,paid:null,pending:null,reason:null,allocation:null,estimates:[],items:[{packageId:pkg.id,revision:1,start:b.start,nights:b.nights}],daily:[],sharedCosts:[],unknowns:[],packages:[{id:pkg.id,revision:1,snapshot:pkg}]};
    await ctx.snowTrip.savePlan(plan);
    pkg={...pkg,validTo:'2026-12-30',revision:2};await ctx.snowTrip.savePackage(pkg,1);
    assert.equal((await read('2026-12-31')).packages.length,0);assert.equal((await read('2027-01-02')).plans.length,1);
    assert.equal((await ctx.snowTrip.getPlan(plan.id)).packages[0].snapshot.validTo,'2027-01-02');
    await ctx.snowTrip.deletePackage(pkg.id,pkg.revision,true,[plan.id]);
    assert.deepEqual(await read('2027-01-02'),{packages:[],pendingPackages:[],plans:[]});
  }finally{await owner.dispose();await rm(root,{recursive:true,force:true});}
});


test('四个月的雪季总览：十二月至三月、跨年闰日、统计按记录与日期去重',()=>{
  const season=seasonCalendar([a,a,c],[b,b]);
  assert.deepEqual(season.months.map(localDay),['2026-12-01','2027-01-01','2027-02-01','2027-03-01']);
  assert.equal(season.days.size,121);assert.equal(season.packageCount,1);assert.equal(season.planCount,1);assert.equal(season.plannedDays,3);
  assert.equal(season.days.has('2026-11-30'),false);assert.equal(season.days.has('2027-04-01'),false);
  assert.equal(seasonCalendar([],[],'2026-01','2027-12').months.length,24);
  const jan=seasonCalendar([a,c],[b],'2027-01','2027-01');
  assert.equal(jan.months.length,1);assert.equal(jan.days.size,31);assert.equal(jan.plannedDays,2);assert.equal(jan.planCount,1);
  for(const value of [null,{}, {start:'2025-12',end:'2027-01'},{start:'2026-13',end:'2027-01'},{start:'2027-02',end:'2027-01'}])assert.equal(validMonthRange(value),false);
  assert.throws(()=>seasonCalendar([],[],'2027-02','2027-01'));

});

test('图例多选：空选和全选展示全部，部分选择仅显示对应类型',()=>{
 const raw={plans:[{id:'confirmed',tracking:{booking:'confirmed'}},{id:'draft'}],packages:[a],pendingPackages:[c]};
 for(const filters of [[],['confirmed','draft','packages','pending']])assert.deepEqual(filterCalendarDay(raw,filters),raw);
 assert.deepEqual(filterCalendarDay(raw,['confirmed','packages']),{plans:[raw.plans[0]],packages:[a],pendingPackages:[]});
 assert.deepEqual(filterCalendarDay(raw,['draft','pending']),{plans:[raw.plans[1]],packages:[],pendingPackages:[c]});
});
