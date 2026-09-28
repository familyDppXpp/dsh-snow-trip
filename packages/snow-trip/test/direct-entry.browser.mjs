// 只打开、关闭工作台，不创建会话或发送消息。
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
assert.ok(process.env.SNOW_URL,'请通过 SNOW_URL 提供测试实例入口');
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
try{
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const url=new URL(process.env.SNOW_URL);
 url.searchParams.delete('app');
 await page.goto(url.href);
 const entry=page.getByRole('button',{name:'打开雪季出行工作台',exact:true});
 const dialog=page.getByRole('dialog',{name:'雪季出行工作台',exact:true});
 await entry.waitFor();assert.equal(await dialog.isVisible(),false);
 url.searchParams.set('app','snow-trip');
 await page.goto(url.href);
 await dialog.waitFor();
 await dialog.getByRole('button',{name:'返回 DSH',exact:true}).click();
 await dialog.waitFor({state:'hidden'});
 await entry.click();await dialog.waitFor();
 await page.reload();await dialog.waitFor();
 await dialog.getByRole('button',{name:'返回 DSH',exact:true}).waitFor();
 url.searchParams.set('app','other');
 await page.goto(url.href);await entry.waitFor();
 assert.equal(await dialog.isVisible(),false);
 assert.deepEqual(errors,[]);
 console.log('通过：参数直达、刷新自动打开、关闭返回、手动重开与其他参数不自动打开。');
}finally{await browser.close();}
