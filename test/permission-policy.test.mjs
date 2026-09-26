import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../src/permission-policy.js';
test('雪季权限命令拒绝切换，并在模型组装前恢复工作区内修改',()=>{
 let command,assemble;const session={preset:'danger-full-access'};
 const ctx={commands:{register:value=>{command=value;}},permissionPresets:{set:(s,preset)=>{s.preset=preset;}},on:(name,handler)=>{assert.equal(name,'system-prompt/assemble');assemble=handler;}};
 apply(ctx);
 for(const rawInput of ['danger-full-access','read-only','auto']){
  session.preset=rawInput;
  assert.equal(command.handler({agent:{session},rawInput}).kind,'error');
  assert.equal(session.preset,'workspace-write');
 }
 assert.equal(command.handler({agent:{session},rawInput:'workspace-write'}).kind,'success');
 session.preset='danger-full-access';
 assert.equal(assemble({}, {agent:{session}},()=>{assert.equal(session.preset,'workspace-write');return 'assembled';}),'assembled');
});
