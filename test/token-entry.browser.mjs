// 新浏览器会话经过 token 登录后，仍应直接打开工作台。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const launch=(await readFile(process.env.SNOW_HOST_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)[0];
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
try {
 const page=await browser.newPage();
 page.setDefaultTimeout(10000);
 const query=new URL(launch);query.searchParams.set('app','snow-trip');
 await page.goto(query.toString(),{waitUntil:'networkidle'});
 console.log('查询参数登录后是否保留：',new URL(page.url()).searchParams.has('app'));
 const url=new URL(launch);url.hash='app=snow-trip';
 const context=await browser.newContext();const fresh=await context.newPage();fresh.setDefaultTimeout(10000);
 await fresh.goto(url.toString(),{waitUntil:'networkidle'});
 await fresh.getByRole('dialog',{name:'雪季出行工作台',exact:true}).waitFor();
 assert.equal(new URL(fresh.url()).hash,'#app=snow-trip');
 assert.equal(new URL(fresh.url()).searchParams.has('token'),false);
 console.log('通过：新会话完成 token 登录后直接打开雪季工作台。');
}finally{await browser.close();}
