// 验证历史工具详情，不调用模型或操作待确认卡片。
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
  await page.locator('.snow-conversation [data-turn-process]').first().waitFor();
  for(const button of await page.locator('.snow-conversation [data-turn-process]').all()) {
    if(await button.isEnabled()&&await button.getAttribute('aria-expanded')==='false')await button.click();
  }
  const groups=page.locator('.snow-conversation [data-step-process]');
  assert.ok(await groups.count()>0,'历史会话应包含工具分组');
  for(const group of await groups.all()) {
    const header=group.locator('[data-process-activity]').first();
    if(await header.isVisible()&&await header.getAttribute('aria-expanded')==='false')await header.click();
  }
  const tool=page.locator('.snow-conversation [data-tool="snow_query"]');
  await tool.first().waitFor({timeout:5000});
  const row=tool.first().locator('[data-disclosure-row]');
  await row.click();
  assert.ok((await tool.first().innerText()).includes('输出'),'展开后应显示实际工具结果');
  assert.equal(await page.locator('[data-snow-hidden-tool]').count(),0);
  console.log('通过：历史工具分组展开可见工具条目，工具详情含实际输出。');
} finally {await browser.close();}
