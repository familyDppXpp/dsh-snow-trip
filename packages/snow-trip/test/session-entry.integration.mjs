// 对已安装产物检查；需同一隔离 profile 安装 test/integration-host。
// SNOW_HOST_LOG、SNOW_WORKSPACE、SNOW_PLAYWRIGHT 指定测试环境；不输出登录 URL 或凭据。
import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir, rename} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
await mkdir(resolve('.local'),{recursive:true});
const url=process.env.SNOW_DSH_URL||(await readFile(process.env.SNOW_HOST_LOG,'utf8')).match(/http:\/\/127\.0\.0\.1:\d+[^\s\x1b]*/)?.[0];
assert.ok(url,'需提供 DSH 测试地址');
const browser=await chromium.launch({headless:true,...(process.env.SNOW_CHROME?{executablePath:process.env.SNOW_CHROME}:{})});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
const errors=[];page.on('pageerror',error=>errors.push(error.message));
const report={};
const check=async(name,run)=>{await run();report[name]='通过';console.log(`通过：${name}`);};
try {
  await page.goto(url,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.snowSessionCheck,{timeout:30000});
  const workspacePath=resolve(process.env.SNOW_WORKSPACE||'.local/session-entry-workspace');
  await mkdir(workspacePath,{recursive:true});
  const workspace=await page.evaluate(path=>window.snowSessionCheck.workspace(path),workspacePath);
  const ordinary=await page.evaluate(id=>window.snowSessionCheck.normal(id),workspace.workspaceId);
  await check('雪季预设发现，宿主默认预设保留',async()=>{
    const result=await page.evaluate(()=>window.snowSessionCheck.presets());
    assert.equal(result.ok,true);
    assert.ok(result.value.presets.some(row=>row.id==='snow-trip'&&!row.broken));
    assert.equal(result.value.presets.find(row=>row.isDefault).id,process.env.SNOW_EXPECTED_DEFAULT||'standard');
  });
  await check('认证 Remote 返回套餐集合，未授权请求被拒绝',async()=>{
    const result=await page.evaluate(()=>window.snowSessionCheck.listPackages());
    assert.equal(result.ok,true);assert.ok(Array.isArray(result.value));
    // 新 HTTP 上下文无登录 Cookie 或 Bearer，仍通过宿主认证入口。
    const response=await fetch(new URL('/api/snowTrip/listPackages',url),{method:'POST',headers:{'Content-Type':'application/json','Origin':new URL(url).origin},body:JSON.stringify({args:{}})});
    assert.ok([401,403].includes(response.status),`未授权响应 ${response.status}`);
  });
  await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'雪季出行工作台',exact:true});
  await check('原工作台首页保留，套餐概览和会话入口并存',async()=>{
    await dialog.getByRole('heading',{name:/下一站，.*去山里过冬/}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'套餐概览',exact:true}).count(),0);
    assert.equal(await dialog.getByRole('button',{name:'开始录入',exact:true}).count(),2);
    await dialog.getByRole('button',{name:'开始录入',exact:true}).first().waitFor();
    assert.equal(await dialog.getByRole('button',{name:'旧版台账与方案',exact:true}).count(),0);
    assert.equal(await dialog.getByRole('button',{name:'套餐与来源',exact:true}).count(),0);
    for(const name of ['找出行方案','已存方案']) assert.equal(await dialog.getByRole('button',{name,exact:true}).count(),1);

    await page.screenshot({path:'.local/session-entry-homepage.png'});
  });
  assert.equal(await dialog.getByLabel('会话工作区',{exact:true}).count(),0);
  await dialog.getByRole('button',{name:'出发去山野',exact:true}).click();
  const editor=dialog.locator('[contenteditable=true]');
  await editor.waitFor();
  const first=await page.evaluate(()=>window.snowSessionCheck.state().current);
  await check('独立输入框的斜杠菜单与技能选择不自动发送',async()=>{
    await editor.fill('/');
    const menu=dialog.getByRole('listbox',{name:'触发候选建议'});
    await menu.waitFor();
    for(const name of ['export','feedback','permission','model','snow-import']) {
      await menu.getByRole('option',{name:new RegExp('^'+name+' ')}).waitFor();
    }
    await menu.getByRole('option',{name:/^snow-import /}).click();
    assert.match(await editor.innerText(),/snow-import/);
    assert.equal(await page.evaluate(id=>window.snowSessionCheck.state().byId[id].blank,first),true);
    await editor.fill('');
  });
  await check('新建空白雪季会话，排除普通会话',async()=>{
    const state=await page.evaluate(()=>window.snowSessionCheck.state());
    assert.notEqual(first,ordinary);assert.equal(state.byId[first].projectionValues.agentPreset,'snow-trip');
    assert.equal(state.byId[first].blank,true);assert.equal(await editor.innerText(),'');
    const list=dialog.getByLabel('雪季会话列表');
    assert.equal(await list.locator('.snow-session-open').count(),Object.values(state.byId).filter(row=>row.projectionValues?.agentPreset==='snow-trip').length);
  });
  await dialog.getByRole('button',{name:'找出行方案',exact:true}).click();
  await dialog.getByRole('button',{name:'开始录入',exact:true}).first().waitFor();
  await dialog.getByLabel('雪季会话列表').locator('.snow-session-open').first().click();
  if(process.env.SNOW_REAL_MODEL==='1') {
    await check('真实模型响应，运行中关闭工作台后可继续历史',async()=>{
      await editor.fill('请用中文解释滑雪前热身有什么作用，回答不超过三句话。');
      await editor.press('Enter');
      await page.waitForFunction(id=>window.snowSessionCheck.state().byId[id]?.running,first,{timeout:30000});
      await dialog.getByRole('button',{name:'返回 DSH',exact:true}).click();
      await page.waitForFunction(id=>!window.snowSessionCheck.state().byId[id]?.running,first,{timeout:120000});
      await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
      await dialog.locator('.snow-conversation').getByText('请用中文解释滑雪前热身有什么作用，回答不超过三句话。',{exact:true}).waitFor();
      const body=await dialog.locator('.snow-conversation').innerText();
      assert.equal(await dialog.locator('[data-chat-flow-kind="turn-error"]').count(),0,body);
      const answer=await dialog.locator('[data-chat-flow-kind="assistant-step"]').allTextContents();
      assert.ok(answer.some(text=>text.trim().length>0),'没有观察到真实助理回复');
      report.modelConversation=body;
    });
  } else {report['真实模型响应']='未验证（需 SNOW_REAL_MODEL=1）';}
  await dialog.getByRole('button',{name:'找出行方案',exact:true}).click();
  await dialog.getByRole('button',{name:'出发去山野',exact:true}).click();
  await editor.waitFor();
  const second=await page.evaluate(()=>window.snowSessionCheck.state().current);
  await check('草稿可修改、真实附件选择、不自动发送',async()=>{
    await editor.fill('用户修改后的未发送草稿');
    await dialog.locator('.snow-conversation input[type=file]').setInputFiles({name:'雪季接入检查.txt',mimeType:'text/plain',buffer:Buffer.from('SNOW-01 真实附件路径检查')});
    await dialog.getByText('雪季接入检查.txt',{exact:true}).waitFor();
    await page.waitForTimeout(1500);
    const state=await page.evaluate(()=>window.snowSessionCheck.state());
    assert.equal(state.byId[second].blank,true);assert.equal(state.byId[second].running,false);
  });
  await check('关闭重开保留草稿与附件，列表可切回原会话',async()=>{
    await dialog.getByRole('button',{name:'返回 DSH',exact:true}).click();
    await page.getByRole('button',{name:'打开雪季出行工作台',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.snow-conversation [contenteditable=true]')?.textContent==='用户修改后的未发送草稿');
    await dialog.getByText('雪季接入检查.txt',{exact:true}).waitFor();
    const state=await page.evaluate(()=>window.snowSessionCheck.state());
    const title=state.byId[first].title||(state.byId[first].blank?'新会话':state.byId[first].displayTitle)||'未命名会话';
    await dialog.locator(`.snow-session-row[data-session-id="${first}"] .snow-session-open`).click();
    assert.equal(await page.evaluate(()=>window.snowSessionCheck.state().current),first);
    await page.waitForFunction(title=>document.querySelector('.snow-session-list [aria-current="page"] strong')?.textContent===title,title);
  });
  assert.deepEqual(errors,[]);
  await page.screenshot({path:'.local/session-entry.png'});
  if(process.env.SNOW_PRESET_FILE) {
    await check('真实预设加载失败显示提示，不进入错误助理输入区',async()=>{
      const file=resolve(process.env.SNOW_PRESET_FILE),backup=`${file}.test-disabled`;
      await rename(file,backup);
      try {
        await dialog.getByRole('button',{name:'出发去山野',exact:true}).click();
        await dialog.getByRole('alert').filter({hasText:'雪季预设选择失败'}).waitFor();
        assert.equal(await editor.count(),0);
      } finally {await rename(backup,file);}
    });
  }
  await check('手机视口可见导航与会话入口',async()=>{
    await page.setViewportSize({width:390,height:844});
    await dialog.getByRole('button',{name:'找出行方案',exact:true}).click();
    assert.equal(await dialog.getByRole('button',{name:'出发去山野',exact:true}).isVisible(),true);
    const box=await dialog.boundingBox();assert.ok(box.width<=390);
    await page.screenshot({path:'.local/session-entry-mobile.png'});
  });
} catch(error) {
  report.failure=error.message;process.exitCode=1;
  console.error('集成检查失败：',error.message);
  console.error((await page.locator('body').innerText()).slice(-3500));
  await page.screenshot({path:'.local/session-entry-failure.png'});
} finally {
  await writeFile('.local/session-entry-result.json',JSON.stringify(report,null,2));
  await browser.close();
}
