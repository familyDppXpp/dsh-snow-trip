import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const url=(await readFile(process.env.SNOW_HOST_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)?.[0];
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
try{
  const page=await browser.newPage();await page.goto(url,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'雪季出行工作台',exact:true});
  await panel.getByRole('button',{name:'新增会话',exact:true}).click();
  await panel.locator('.snow-conversation [contenteditable=true]').waitFor();
  const id=await page.evaluate(()=>window.snowSessionCheck.state().current);
  assert.equal(await panel.locator(`.snow-session-row[data-session-id="${id}"]`).count(),0);
  const visible=await panel.locator('.snow-session-row').evaluateAll(rows=>rows.map(row=>row.dataset.sessionId));
  assert.ok(await page.evaluate(ids=>ids.every(id=>!window.snowSessionCheck.state().byId[id].blank),visible));
  await panel.getByLabel('搜索会话',{exact:true}).fill('新会话');
  assert.equal(await panel.locator(`.snow-session-row[data-session-id="${id}"]`).count(),0);
  console.log('通过：空白会话不出现在列表或搜索中，新增后聊天输入区仍可用。');
}finally{await browser.close();}
