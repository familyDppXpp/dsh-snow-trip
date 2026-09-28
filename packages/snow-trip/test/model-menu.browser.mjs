// 验证宿主模型菜单在工作台模态层内可操作；不发送模型请求。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const url=process.env.SNOW_DSH_URL||(await readFile(process.env.SNOW_HOST_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)?.[0];
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
try {
  const page=await browser.newPage({viewport:{width:1507,height:858}});
  page.setDefaultTimeout(10000);
  page.on('pageerror',e=>console.log(e.message));
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
  await panel.getByRole('button',{name:/^选择模型/}).click();
  const model=page.getByRole('menuitem',{name:/模型/}).first();
  await model.click({timeout:3000});
  await page.getByRole('menuitemradio',{name:/MiniMax-M3/}).waitFor();
  const models=await panel.getByRole('menuitemradio').allTextContents();
  assert.ok(models.length>1);
  await panel.getByRole('menuitemradio',{name:'MiniMax-M3',exact:true}).click();
  await panel.getByRole('button',{name:/^选择模型，当前 MiniMax-M3/}).waitFor();
  const editor=panel.locator('.snow-conversation [contenteditable=true]');
  await editor.fill('/model');
  await panel.getByRole('option').filter({hasText:'model'}).click();
  await panel.getByRole('option',{name:/MiniMax-M3/}).waitFor();
  const slash=await panel.getByRole('option').allTextContents();
  for(const name of models)assert.ok(slash.some(row=>row.includes(name.trim())),`斜杠菜单缺少 ${name}`);
  await editor.press('Escape');
  console.log('通过：右下角菜单可点击，两处模型一致，仍选择 MiniMax-M3。');
}finally{await browser.close();}
