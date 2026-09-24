import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePackage} from '../src/packages.ts';
import {packageTurnDefinition as definition,selectTurnPackages} from '../src/package-turns.js';

test('轮次外卡片只接收成功保存，按套餐去重且回放不串轮次',()=>{
  const record={...normalizePackage({name:'套餐',quote:129900}),id:crypto.randomUUID(),revision:1,schemaVersion:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sessionId:'test'};
  let state=definition.start(null,{event:{data:{turn:1}}});
  const apply=event=>{assert.ok(definition.match(event));state=definition.update({state},{event});};
  const call=(name,callId)=>apply({type:'tool/call',data:{turn:1,name,callId}});
  const result=(callId,seq,meta,isError=false)=>apply({type:'tool/result',surfaceOp:'append',seq,data:{turn:1,meta,message:{source:{callId},content:[{isError}]}}});
  call('snow_surcharge','draft');result('draft',2,{version:1,record});
  call('snow_commit','fail');result('fail',3,{version:1,record},true);
  call('snow_commit','bad');result('bad',4,{version:99,record});
  assert.equal(state.records.length,0);
  call('snow_save_packages','legacy');result('legacy',5,{version:1,record});
  call('snow_commit','new');result('new',7,{version:1,record:{...record,revision:2}});
  const location=definition.buildLocationData({state},'turn');
  assert.equal(location.key,definition.kind);
  const owner={turn:{data:{get:()=>location.value}},seq:8};
  assert.equal(selectTurnPackages(owner).length,1);
  assert.equal(selectTurnPackages(owner)[0].revision,2);
  assert.equal(selectTurnPackages({...owner,seq:6})[0].revision,1);
  assert.equal(selectTurnPackages({turn:{data:{get:()=>undefined}},seq:8}),null);
  assert.equal(definition.match({type:'tool/result',surfaceOp:'replace',data:{turn:1}}),null);
});
