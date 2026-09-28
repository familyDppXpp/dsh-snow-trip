import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as plugin from 'dsh-snow-trip';
import * as tools from 'dsh-snow-trip/tools';
import * as permissions from 'dsh-snow-trip/permissions';
import {SnowTrip} from '../lib/server/service.js';

test('公开入口直接加载编译后的服务与工具',()=>{
  assert.equal(plugin.SnowTrip,SnowTrip);
  assert.equal(plugin.name,'dsh-snow-trip');
  for(const entry of [plugin,tools,permissions]) assert.equal(typeof entry.apply,'function');
});
