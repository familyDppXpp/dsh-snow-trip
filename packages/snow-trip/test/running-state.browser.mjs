// 用配置中的 MiniMax-M3 验证运行状态的完整生命周期。
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
  await page.getByRole('button',{name:'出发去山野',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'雪季出行工作台',exact:true});
  await panel.getByText('MiniMax-M3',{exact:true}).waitFor();
  const editor=panel.locator('.snow-conversation [contenteditable=true]');
  await editor.fill('请用约100字介绍滑雪出行前的行李准备，不调用工具。');
  await editor.press('Enter');
  const status=panel.locator('.snow-running');
  await status.waitFor({timeout:30000});
  assert.equal(await status.getAttribute('role'),'status');
  assert.equal(await status.locator('span').evaluate(el=>getComputedStyle(el).animationName),'snow-running-pulse');
  await status.waitFor({state:'detached',timeout:180000});
  console.log('通过：MiniMax-M3 发送后显示运行状态和动画，完成后自动消失。');
} finally {await browser.close();}
