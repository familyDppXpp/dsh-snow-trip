// 在已启动并安装本包的隔离 DSH profile 检查真实拖拽与键盘边界。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const url=process.env.SNOW_DSH_URL||(await readFile(process.env.SNOW_HOST_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)?.[0];
assert.ok(url,'需要验收地址或启动日志');
const browser=await chromium.launch({headless:true,...(process.env.SNOW_CHROME?{executablePath:process.env.SNOW_CHROME}:{})});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
  const handle=page.getByRole('separator',{name:'调整侧边栏宽度'});
  await handle.waitFor();
  const rail=page.locator('.snow-rail');
  const width=async()=>Math.round((await rail.boundingBox()).width);
  const original=await width();
  const box=await handle.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+100);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+100,box.y+100,{steps:8});
  await page.mouse.up();
  assert.equal(await width(),original+100);
  await page.mouse.move(900,500);
  assert.equal(await width(),original+100,'松手后不应继续调整');
  await handle.press('Home');assert.equal(await width(),145);
  await handle.press('ArrowRight');assert.equal(await width(),155);
  await handle.press('End');assert.equal(await width(),420);
  await handle.press('ArrowRight');assert.equal(await width(),420);
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('.snow-rail').getBoundingClientRect().width<=195);
  assert.equal(await width(),195);
  assert.equal(await page.getByRole('button',{name:'出发去山野',exact:true}).isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('通过：拖拽增宽、松手停止、键盘调整、上下限与手机宽度约束。');
} finally {await browser.close();}
