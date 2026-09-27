// 在隔离的 DSH 0.1.7-rc.2 profile 中安装本包和 integration-host 后执行。
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const url=process.env.SNOW_DSH_URL||(await readFile(process.env.SNOW_HOST_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)?.[0];
assert.ok(url,'需要 SNOW_DSH_URL 或 SNOW_HOST_LOG');
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.snowSessionCheck);
  const welcome=page.getByRole('button',{name:'继续',exact:true});
  if(await welcome.isVisible())await welcome.click();
  const setup=page.getByRole('button',{name:'稍后配置',exact:true});
  if(await setup.isVisible())await setup.click();
  const presets=await page.evaluate(()=>window.snowSessionCheck.presets());
  assert.equal(presets.ok,true);
  assert.ok(presets.value.presets.some(p=>p.id==='snow-trip'&&!p.broken));
  assert.ok(presets.value.presets.some(p=>p.id==='standard'));
  const packages=await page.evaluate(()=>window.snowSessionCheck.listPackages());
  assert.equal(packages.ok,true);assert.ok(Array.isArray(packages.value));
  await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
  const panel=page.getByRole('dialog',{name:'雪季出行工作台',exact:true});
  await panel.getByRole('button',{name:'出发去山野',exact:true}).click();
  const editor=panel.locator('.snow-conversation [contenteditable=true]');
  await editor.waitFor();
  const state=await page.evaluate(()=>window.snowSessionCheck.state());
  assert.equal(state.byId[state.current].projectionValues.agentPreset,'snow-trip');
  assert.equal(state.byId[state.current].blank,true);
  await editor.fill('/');
  await panel.getByRole('option',{name:/^snow-import /}).waitFor();
  await panel.getByRole('option',{name:/^snow-plan /}).waitFor();
  await editor.fill('兼容性检查草稿，不发送');
  await panel.getByRole('button',{name:'返回 DSH',exact:true}).click();
  await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
  await editor.waitFor();
  assert.match(await editor.innerText(),/兼容性检查草稿/);
  if(process.env.SNOW_REAL_MODEL==='1'||process.env.SNOW_VERIFY_SAVED) {
    let saved;
    if(process.env.SNOW_VERIFY_SAVED) saved=packages.value.find(record=>record.id===process.env.SNOW_VERIFY_SAVED);
    else {
    await panel.getByText('MiniMax-M3',{exact:true}).waitFor();
    const name=`兼容性测试套餐-${Date.now()}`;
    await editor.fill(`/snow-import 请录入一份未购买套餐：名称${name}，长白山住宿，报价1299元，住宿2晚，酒店和有效期未知。请直接展示保存确认卡，缺少信息保持未知，不要追问。`);
    await editor.press('Enter');
    await panel.getByRole('button',{name:'确认保存',exact:true}).waitFor({timeout:180000});
    assert.equal((await page.evaluate(()=>window.snowSessionCheck.listPackages())).value.length,packages.value.length);
    await panel.getByRole('button',{name:'确认保存',exact:true}).click();
    await page.waitForFunction(async name=>{
      const result=await window.snowSessionCheck.listPackages();
      return result.ok&&result.value.some(record=>record.name===name);
    },name,{timeout:120000});
    saved=(await page.evaluate(()=>window.snowSessionCheck.listPackages())).value.find(record=>record.name===name);
    }
    assert.ok(saved);
    assert.equal(saved.purchaseStatus,'unpurchased');assert.equal(saved.quote,129900);assert.equal(saved.revision,1);
    await panel.getByRole('button',{name:/^已录套餐/}).click();
    await panel.getByRole('button',{name:/^入住日期：/}).click();
    await panel.getByRole('button',{name:'清空日期',exact:true}).click();
    await panel.getByRole('button',{name:'查找套餐',exact:true}).click();
    await panel.locator(`[data-package-id="${saved.id}"]`).first().waitFor();
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(()=>!!window.snowSessionCheck);
    const reread=await page.evaluate(()=>window.snowSessionCheck.listPackages());
    assert.equal(reread.value.find(record=>record.id===saved.id).revision,1);
    console.log(process.env.SNOW_VERIFY_SAVED?'通过：真实模型已保存套餐的首页展示与刷新持久化。':'通过：MiniMax-M3 真实调用技能和工具、人工确认前不落盘、确认保存、首页展示与刷新持久化。');
  }
  assert.deepEqual(errors,[]);
  console.log('通过：新版预设、Remote 读取、工作台、新建会话、技能菜单与草稿保留。');
} finally {await browser.close();}
