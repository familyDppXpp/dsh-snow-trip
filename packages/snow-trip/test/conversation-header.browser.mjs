// 检查顶部栏和侧面板响应式行为，不调用模型。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const url=process.env.SNOW_DSH_URL||(await readFile(process.env.SNOW_HOST_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)?.[0];
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
try {
  const page=await browser.newPage({viewport:{width:1507,height:858}});
  page.setDefaultTimeout(10000);
  const errors=[];
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  page.on('pageerror',error=>errors.push(error.message));
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
  const panel=page.getByRole('dialog',{name:'雪季出行工作台',exact:true});
  const header=panel.locator('.snow-conversation header').first();
  await header.waitFor();
  await panel.locator('#snow-package-sidebar').waitFor();
  const close=header.getByRole('button',{name:'收起套餐详情',exact:true});
  await close.click();
  await panel.locator('#snow-package-sidebar').waitFor({state:'detached'});
  await panel.getByRole('button',{name:'展开套餐详情',exact:true}).click();
  await panel.locator('#snow-package-sidebar').waitFor();
  await page.setViewportSize({width:700,height:858});
  await panel.locator('#snow-package-sidebar').waitFor({state:'detached'});
  await page.setViewportSize({width:1507,height:858});
  await panel.locator('#snow-package-sidebar').waitFor();
  await close.click();
  const second=records.value.find(row=>row.sessionId&&row.sessionId!==record.sessionId);
  assert.ok(second,'需要两个已有会话验证切换');
  await panel.locator(`[data-session-id="${second.sessionId}"] .snow-session-open`).click();
  await panel.locator('#snow-package-sidebar').waitFor();
  assert.equal(await close.getAttribute('aria-expanded'),'true');
  assert.deepEqual(errors,[]);
  console.log('通过：会话顶部栏、详情切换、窄屏收起、宽屏恢复和切换会话默认展开。');
} finally {await browser.close();}
