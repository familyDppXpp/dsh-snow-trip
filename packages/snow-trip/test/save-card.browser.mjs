// SNOW_PLAYWRIGHT、SNOW_REACT_DOM 指向已有依赖；仅使用合成数据，不连接业务存储。
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const script=await build({stdin:{contents:`
import React from 'react';import {createRoot} from ${JSON.stringify(process.env.SNOW_REACT_DOM||'react-dom/client')};
import {SaveCard} from './src/client/save-card.jsx';import {normalizePackage} from './src/shared/packages.ts';
const preview=normalizePackage({name:'长白山测试套餐',description:'长套餐说明。'.repeat(400),otherBenefits:['晚餐券2张','接送1次'],nights:3,quote:129900,hotels:['测试酒店'],surchargeRules:[],skiIncluded:true,skiTickets:2,skiBasis:'night',breakfastIncluded:true,breakfastPeople:2,breakfastBasis:'day',spaIncluded:true,spaPeople:2,spaVisits:1,spaBasis:'order',splitAllowed:true,splitRule:'每次至少住2晚'});
const previous={...preview,id:'5d7246cd-1606-4794-8087-2597c32fce58',revision:1,schemaVersion:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sessionId:'test'};
let item={callId:'check'},old=null,p=preview;const root=createRoot(document.getElementById('root'));
const pending={questions:[{id:'snow-commit-check',detail:''}],answer:async answer=>{window.answer=answer;}};
function render(){pending.questions[0].detail=JSON.stringify({callId:'check',previous:old,preview:p});root.render(<div className="snow snow-save-composer"><SaveCard key={window.mode||'new'} item={item} pending={item.done?null:pending}/></div>)};
window.demo={stop(){item={callId:'check',done:true,stopped:true,error:null};render()},update(){window.mode='update';old=previous;p={...preview,nights:4,quote:null,otherBenefits:['晚餐券3张','接送1次']};item={callId:'check'};render()},finish(status){item={callId:'check',done:true,meta:{version:2,status,previous:old,preview:p,record:status==='saved'?{...previous,...p,revision:old?2:1}:null}};render()},fail(){item={callId:'check',done:true,error:'版本已变更，请重新查询并确认'};render()}};render();`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',alias:{react:process.cwd()+'/node_modules/react'},jsx:'automatic'});
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
const page=await browser.newPage({viewport:{width:900,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 page.setDefaultTimeout(5000);
 await page.setContent('<meta charset="utf-8"><main id="root"></main>');await page.addStyleTag({content:await readFile('src/client/style.css','utf8')});await page.addScriptTag({content:script.outputFiles[0].text});
 const card=page.locator('.snow-save-card');await card.waitFor();const box=await card.getByRole('button',{name:'确认保存',exact:true}).boundingBox();assert.ok(box.y>=0&&box.y+box.height<=1000,'长卡片操作按钮保持可见');assert.ok(await card.locator('.snow-save-body').evaluate(e=>e.scrollHeight>e.clientHeight),'长内容在卡片内部滚动');await page.getByRole('button',{name:'确认保存',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-save-state="saving"]'));
 assert.equal(await card.count(),1);assert.equal(await card.getByRole('button',{name:'继续调整'}).isDisabled(),true);
 await page.evaluate(()=>window.demo.finish('saved'));await page.waitForFunction(()=>document.querySelector('[data-save-state="saved"]'));
 assert.equal(await card.getByRole('button').count(),0);assert.match(await card.innerText(),/已确认无/);assert.match(await card.innerText(),/2张.*每晚/);assert.match(await card.innerText(),/2人.*每日/);assert.match(await card.innerText(),/2人.*1次.*整单/);assert.match(await card.innerText(),/可拆分.*每次至少住2晚/);
 await page.evaluate(()=>window.demo.update());await page.waitForFunction(()=>document.querySelector('[data-save-state="confirm"]'));
 assert.match(await card.innerText(),/3 间夜.*→.*4 间夜/s);assert.match(await card.innerText(),/晚餐券2张.*→.*已移除/s);assert.match(await card.innerText(),/无此项.*→.*晚餐券3张/s);assert.doesNotMatch(await card.innerText(),/接送1次/);assert.match(await card.innerText(),/待确认（清空）/);
 await mkdir('.local',{recursive:true});await page.screenshot({path:'.local/save-card-update.png'});
 await page.evaluate(()=>{window.answer=null;});await card.getByRole('button',{name:'继续调整'}).click();assert.equal(await page.evaluate(()=>window.answer.answers[0].selected[0]),'继续调整');await page.evaluate(()=>window.demo.finish('adjusting'));await page.waitForFunction(()=>document.querySelector('[data-save-state="adjusting"]'));
 assert.equal(await card.getByRole('alert').count(),0);assert.match(await card.innerText(),/未保存/);assert.match(await card.innerText(),/3 间夜.*→.*4 间夜/s);assert.match(await card.innerText(),/晚餐券2张.*→.*已移除/s);assert.match(await card.innerText(),/无此项.*→.*晚餐券3张/s);assert.doesNotMatch(await card.innerText(),/接送1次/);assert.match(await card.innerText(),/待确认（清空）/);assert.equal(await card.locator('.package-benefits').count(),0);
 await page.evaluate(()=>window.demo.fail());await page.getByRole('alert').waitFor();assert.match(await card.innerText(),/版本已变更/);
 await page.evaluate(()=>window.demo.stop());await page.waitForFunction(()=>document.querySelector('[data-save-state="stopped"]'));assert.equal(await card.getByRole('alert').count(),0);assert.match(await card.innerText(),/已停止 · 未保存/);assert.equal(await card.getByRole('button').count(),0);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(errors,[]);console.log('通过：确认、保存中禁用、成功、继续调整、失败、清空差异与窄屏布局。');
}finally{await browser.close();}
