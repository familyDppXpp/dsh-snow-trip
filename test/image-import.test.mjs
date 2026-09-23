import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePackage,packageSummary} from '../src/packages.ts';

test('图文缺项与冲突问题保留，来源字段不可作为工具输入，旧记录正常读取',()=>{
  const p=normalizePackage({name:'长白山',pendingQuestions:['截图与文字报价冲突，请确认']});
  assert.equal(p.nights,null);assert.equal(p.quote,null);
  assert.match(packageSummary(p),/报价冲突/);
  for(const field of ['source','sources','sourceNotes'])assert.throws(()=>normalizePackage({name:'测试',[field]:[]}));
});
