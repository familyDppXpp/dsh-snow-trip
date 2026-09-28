// 连接测试实例，只创建空会话和编辑草稿，不发送消息或修改套餐。
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
assert.ok(process.env.SNOW_URL,'请通过 SNOW_URL 提供测试实例入口');
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
try{
  const page=await browser.newPage({viewport:{width:1512,height:863}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(process.env.SNOW_URL,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
  await page.getByRole('button',{name:'出发去山野',exact:true}).click();
  const area=page.locator('.snow-conversation'),editor=area.locator('[data-composer-input]');
  await area.getByRole('heading',{name:/下一站，.*去山里过冬。/s}).waitFor();
  const chooseImport=area.getByRole('button',{name:/录入套餐/}),choosePlan=area.getByRole('button',{name:/规划出行/});
  await editor.fill('测试草稿');
  await chooseImport.click();
  await page.waitForFunction(()=>document.querySelector('.snow-conversation [data-composer-input]').textContent.includes('/snow-import'));
  assert.match(await editor.innerText(),/^\/snow-import 测试草稿$/);
  await choosePlan.click();await choosePlan.click();
  assert.match(await editor.innerText(),/^\/snow-plan 测试草稿$/);
  assert.equal(await area.locator('[data-composer-text-ref]').count(),1);
  const model=area.getByRole('button',{name:/选择模型/});
  await model.waitFor();
  assert.equal(await area.getByRole('button',{name:'更多设置'}).count(),0);
  await model.click();
  await page.getByRole('menu').waitFor();
  await page.keyboard.press('Escape');
  await editor.fill('');
  await page.setViewportSize({width:760,height:900});
  await chooseImport.click();
  assert.equal(await area.evaluate(el=>el.scrollWidth>el.clientWidth),false);
  await editor.fill('');
  assert.deepEqual(errors,[]);
  console.log('通过：技能切换去重、保留草稿、标签显示、模型设置与窄屏布局；未发送消息。');
}finally{await browser.close();}
