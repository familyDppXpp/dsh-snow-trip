import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePackage, packageMetadata} from '../src/packages.ts';

test('不完整套餐保留未知；金额、日期、空资料和冲突必须拒绝',()=>{
  const p=normalizePackage({description:'长白山住宿，尚未购买',purchaseStatus:'unpurchased'});
  assert.equal(p.name,'未命名套餐');assert.equal(p.quote,null);assert.equal(p.paid,null);
  assert.equal(p.hotels,null);assert.equal(p.purchaseStatus,'unpurchased');
  assert.ok(p.unknowns.includes('报价'));assert.equal(p.completeness,'incomplete');
  assert.deepEqual(normalizePackage({name:'测试',hotels:[]}).hotels,[]);
  for(const input of [{},{name:'  '},{purchaseStatus:'purchased'},{name:'测试',quote:-1},{name:'测试',paid:0.1},{name:'测试',validFrom:'2026-02-30'},{name:'测试',validFrom:'2026-12-02',validTo:'2026-12-01'},{name:'测试',nights:1,usedNights:2},{name:'测试',confirmed:true}])assert.throws(()=>normalizePackage(input));
  assert.equal(normalizePackage({quote:0}).quote,0);
  assert.equal(normalizePackage({paid:129900}).paid,129900);
  assert.deepEqual(normalizePackage({unavailableDates:['2026-12-31']}).unavailableDates,['2026-12-31']);
  assert.equal(packageMetadata({version:1,record:{name:'伪造成功'}}),null);
});

test('非法与错误工具 metadata 回退通用结果，合法历史快照可重放',async()=>{
  const {build}=await import('esbuild');
  const bundle=await build({entryPoints:['src/package-cards.jsx'],bundle:true,write:false,platform:'node',format:'esm'});
  const {savedPackage,SavedPackageCard}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const record={...normalizePackage({name:'历史套餐'}),id:'c3fa6a21-1ff7-4e32-a9c2-4e318591f766',schemaVersion:1,revision:1,createdAt:'2026-09-23T00:00:00.000Z',updatedAt:'2026-09-23T00:00:00.000Z',sessionId:'test',sources:[{sessionId:'test',messageSeq:1,text:'历史套餐',nature:'fact'}]};
  const {sources,...expected}=record;assert.deepEqual(savedPackage({kind:'result',meta:{version:1,record}}),expected);
  const {purchasePlatform,...legacy}=record;assert.equal(savedPackage({kind:'result',meta:{version:1,record:legacy}}).purchasePlatform,null);
  assert.throws(()=>normalizePackage({name:'测试',sources}));
  assert.equal(normalizePackage({name:'测试',purchasePlatform:'微信小程序 xxx'}).purchasePlatform,'微信小程序 xxx');
  for(const block of [{kind:'result',meta:{version:99}}, {kind:'result',meta:{version:1,record:{}}}, {kind:'result',isError:true,content:[{type:'text',text:'写盘失败'}]},{}]){
    assert.equal(savedPackage(block),null);assert.equal(SavedPackageCard({block}).type,'details');
  }
});
