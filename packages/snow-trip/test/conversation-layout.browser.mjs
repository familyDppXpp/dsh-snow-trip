// 使用已保存的长会话检查布局，不调用模型。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const url=process.env.SNOW_DSH_URL||(await readFile(process.env.SNOW_HOST_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)?.[0];
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
try {
  const page=await browser.newPage({viewport:{width:1507,height:858}});
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.snowSessionCheck);
  for(const name of ['继续','稍后配置']) {
    const button=page.getByRole('button',{name,exact:true});
    if(await button.isVisible())await button.click();
  }
  await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
  const records=await page.evaluate(()=>window.snowSessionCheck.listPackages());
  const record=records.value.find(row=>row.sessionId);
  assert.ok(record,'需要一条已有套餐会话');
  await page.locator(`[data-session-id="${record.sessionId}"] .snow-session-open`).click();
  const editor=page.locator('.snow-conversation [contenteditable=true]');
  await editor.waitFor();
  for(const size of [{width:1507,height:858},{width:1024,height:640}]) {
    await page.setViewportSize(size);
    const scroll=page.locator('.snow-conversation [data-conversation-scroll]');
    await scroll.evaluate(el=>{el.scrollTop=0;});
    const box=await editor.boundingBox();
    assert.ok(box&&box.y>=0&&box.y+box.height<=size.height,'输入框必须在视口内');
    const range=await scroll.evaluate(el=>el.scrollHeight-el.clientHeight);
    assert.ok(range>100,'长会话应具有滚动空间');
    await scroll.hover();
    await page.mouse.wheel(0,400);
    await page.waitForFunction(()=>document.querySelector('.snow-conversation [data-conversation-scroll]').scrollTop>0);
    await editor.fill('布局验证草稿，不发送');
    assert.equal(await editor.innerText(),'布局验证草稿，不发送');
    await editor.fill('');
  }
  console.log('通过：长会话滚轮滚动、输入框可见和输入（两种视口）。');
} finally {await browser.close();}
