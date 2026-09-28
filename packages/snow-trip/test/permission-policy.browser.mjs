// 验证权限入口隐藏，后台仍强制使用工作区内修改权限。
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
  const editor=panel.locator('.snow-conversation [contenteditable=true]');
  assert.equal(await panel.locator('.snow-fixed-permission').count(),0);
  await editor.fill('/');
  await panel.getByRole('option',{name:/^snow-import /}).waitFor();
  assert.equal(await panel.getByRole('option',{name:/^permission /}).count(),0);
  await editor.fill('');
  assert.equal(await panel.getByRole('button',{name:/工作区内修改|访问模式/}).count(),0);
  const result=await page.evaluate(()=>window.snowSessionCheck.permission(window.snowSessionCheck.state().current,'read-only'));
  assert.equal(result.ok,true);assert.equal(result.value.matched,true);
  assert.equal(await page.evaluate(()=>window.snowSessionCheck.permissionState(window.snowSessionCheck.state().current).currentValue),'workspace-write');
  console.log('通过：权限文字及斜杠菜单项已隐藏，其他指令可用，后台权限保持工作区内修改。');
}finally{await browser.close();}
