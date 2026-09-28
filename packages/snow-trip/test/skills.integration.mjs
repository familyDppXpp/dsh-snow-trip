// SNOW_SKILL_FILESYSTEM 指向已安装 DSH 的 skill-filesystem 模块，用真实扫描器验证分发目录。
import assert from 'node:assert/strict';
import {cp,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {Context} from '@deepseek-ai/cordis';
const {FileSystemSkillProvider}=await import(pathToFileURL(process.env.SNOW_SKILL_FILESYSTEM).href);
const root=await mkdtemp(join(tmpdir(),'snow-preset-skills-'));
const controller=new AbortController();
let provider;
try {
  await cp(new URL('../presets/snow-trip/',import.meta.url),root,{recursive:true});
  provider=new FileSystemSkillProvider(new Context(),{signal:controller.signal,invalidate(){}},{customSkillDirs:[join(root,'skills')],includeDefaultRoots:false,watch:false});
  const rows=await provider.list({});
  assert.ok(Array.isArray(rows));
  assert.deepEqual(rows.map(s=>s.name),['snow-import','snow-plan'].sort());
  const skill=await provider.get(rows[0],{});
  assert.match(skill.path,/snow-import\/SKILL\.md$/);
  assert.equal(skill.invocation.userInvocable,true);
  assert.equal(skill.invocation.modelInvocable,true);
  assert.match(skill.content,/## 保存、失败和恢复/);
  const plan=await provider.get(rows.find(s=>s.name==='snow-plan'),{});
  assert.match(plan.path,/snow-plan\/SKILL\.md$/);
  assert.match(plan.content,/## 标准流程/);
  await mkdir(join(root,'skills','sample-next'));
  await writeFile(join(root,'skills','sample-next','SKILL.md'),'---\nname: sample-next\ndescription: 测试新增技能发现\n---\n\n测试正文。\n');
  assert.deepEqual((await provider.list({})).map(s=>s.name).sort(),['sample-next','snow-import','snow-plan']);
  console.log('通过：技能随预设搬迁后可扫描、正文可加载、调用权限正确，新增目录无需修改注册代码。');
} finally {
  controller.abort();await provider?.dispose();await rm(root,{recursive:true,force:true});
}
