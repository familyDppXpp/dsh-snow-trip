import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSnowImageSession} from '../src/sessions.js';
import {normalizePackage,packageSummary} from '../src/packages.ts';

test('图片入口使用宿主草稿附件，不自动发送；附件失败释放并明确报错',async()=>{
  const calls=[],file={type:'image/png',name:'套餐.png'};
  const sessions={create:async()=>{calls.push('create');return 's';},refresh:async()=>{},open:()=>{},scope:()=>({id:'s'}),list:{getSnapshot:()=>({byId:{s:{projectionValues:{agentPreset:'snow-trip'}}}})}};
  const presets={select:async()=>({ok:true})};
  const input={setDraft:t=>calls.push(['draft',t]),addAttachments:ids=>{calls.push(['attachments',ids]);return true;},submit:()=>assert.fail('不得发送')};
  const conversation={input:{for:()=>input},createDrafts:(id,files)=>{assert.equal(id,'s');assert.deepEqual(files,[file]);return [{id:'image'}];},releaseDraftAttachments:()=>calls.push('release')};
  assert.equal(await createSnowImageSession(sessions,presets,conversation,'w',file),'s');
  assert.match(calls[1][1],/截图/);assert.deepEqual(calls[2],['attachments',['image']]);
  input.addAttachments=()=>false;
  await assert.rejects(createSnowImageSession(sessions,presets,conversation,'w',file),/附件/);
  assert.equal(calls.at(-1),'release');
  calls.length=0;
  await assert.rejects(createSnowImageSession(sessions,presets,conversation,'w',{type:'image/svg+xml'}),/PNG/);
  assert.deepEqual(calls,[]);
});

test('图文缺项与冲突问题保留，来源字段不可作为工具输入，旧记录正常读取',()=>{
  const p=normalizePackage({name:'长白山',pendingQuestions:['截图与文字报价冲突，请确认']});
  assert.equal(p.nights,null);assert.equal(p.quote,null);
  assert.match(packageSummary(p),/报价冲突/);
  for(const field of ['source','sources','sourceNotes'])assert.throws(()=>normalizePackage({name:'测试',[field]:[]}));
});
