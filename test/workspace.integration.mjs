import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const url=process.env.SNOW_DSH_URL||(await readFile(process.env.SNOW_HOST_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)?.[0];
const browser=await chromium.launch({headless:true,...(process.env.SNOW_CHROME?{executablePath:process.env.SNOW_CHROME}:{})});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.snowSessionCheck);
  await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'雪季出行工作台',exact:true});
  assert.equal(await panel.getByText('会话工作区',{exact:true}).count(),0);
  const path=join(homedir(),'dsh-snow-trip');
  let workspaceId;
  for(let i=0;i<2;i++) {
    await panel.getByRole('button',{name:'出发去山野',exact:true}).click();
    await panel.locator('.snow-conversation [contenteditable=true]').waitFor();
    const state=await page.evaluate(()=>window.snowSessionCheck.state());
    assert.equal(state.byId[state.current].cwd,path);
    assert.equal((await stat(path)).isDirectory(),true);
    const workspaces=await page.evaluate(()=>window.snowSessionCheck.workspaces());
    const rows=workspaces.items.filter(row=>row.path===path);
    assert.equal(rows.length,1,'重复创建不应新增工作区');
    if(workspaceId) assert.equal(rows[0].workspaceId,workspaceId);
    workspaceId=rows[0].workspaceId;
    assert.ok(rows[0].sessionIds.includes(state.current));
    await panel.getByRole('button',{name:'找出行方案',exact:true}).click();
  }
  console.log('通过：隐藏工作区选择、创建用户目录、会话使用固定目录、重复新建复用工作区。');
} finally {await browser.close();}
