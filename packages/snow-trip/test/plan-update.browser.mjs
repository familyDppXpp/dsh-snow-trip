// 合成数据验证更新卡片的实际点击、只读回放与窄屏布局。
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const bundle=await build({stdin:{contents:`
import React,{useState} from 'react';import {createRoot} from ${JSON.stringify(process.env.SNOW_REACT_DOM||'react-dom/client')};
import {PlanQuestionCard} from './src/client/plans/question-card.tsx';import {PlanInteractionCard} from './src/client/plans/interaction-card.tsx';
const card={stage:'update',key:'check',plan:{title:'禾木滑雪方案',costVersion:2,start:'2027-01-01',nights:2,total:55000,daily:Array.from({length:35},(_,i)=>({date:'住宿第 '+(i+1)+' 晚',amount:10000,basis:'用于验证长内容滚动'})),sharedCosts:[],packages:[]},previous:{title:'禾木滑雪方案',total:45000,tracking:{booking:'confirmed',refund:'refundable',refundPolicy:'出发前可退'}},resetTracking:false,costChange:'增加 ¥100.00',changes:[{label:'雪场（资料修正）',before:'禾木',after:'吉克普林',detail:false},{label:'整趟总成本',before:'¥450.00',after:'¥550.00',detail:false},{label:'共同费用',before:'无',after:'餐饮 ¥100.00',detail:true}]};
function App(){const [saved,setSaved]=useState(null),[fail,setFail]=useState(false),[rename,setRename]=useState(false);const activeCard=rename?{...card,rename:true,plan:{...card.plan,title:'春节滑雪'},changes:[{label:'方案名称',before:card.plan.title,after:'春节滑雪',detail:false}],costChange:'仅修改标题，费用与套餐快照不变'}:card;const pending={questions:[{id:'snow-plan-update-check',question:'核对差异',detail:JSON.stringify(activeCard)}],answer:async({answers:[a]})=>{window.calls=(window.calls??0)+1;await new Promise(resolve=>setTimeout(resolve,80));const save=['确认更新','确认另存'].includes(a.selected[0]);setSaved({status:save?'updated':'adjusting',interaction:{stage:'update',card:activeCard,selected:a.selected,custom:a.custom,action:save?'update':a.selected[0]==='继续调整'?'adjust':a.selected[0]==='取消本次操作'?'cancel':'supplement',status:save?(fail?'failed':'saved'):undefined,error:save&&fail?'套餐已变化，请刷新差异':undefined}});}};return <main className="snow"><button onClick={()=>{setSaved(null);setRename(true);}}>检查改名</button><button onClick={()=>{setSaved(null);window.calls=0;}}>重置检查</button><label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/>模拟保存失败</label>{saved?<PlanInteractionCard data={saved}/>:<div className="snow snow-save-composer"><PlanQuestionCard pending={pending}/></div>}</main>;}createRoot(document.getElementById('root')).render(<App/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',alias:{react:process.cwd()+'/node_modules/react'}});
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});const page=await browser.newPage();page.on('pageerror',error=>console.error(error.message));
try{
 await page.route('http://snow.test/',route=>route.fulfill({body:'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><div id="root"></div></html>',contentType:'text/html'}));
 await page.goto('http://snow.test/');await page.addStyleTag({content:await readFile('src/client/workbench/style.css','utf8')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 const card=page.locator('[data-plan-stage="update"]');
 await page.setViewportSize({width:1100,height:1000});
 const compact=await card.boundingBox();assert.ok(compact.height<780,'短内容不应撑满八成屏高');
 await page.getByText('查看调整后的完整方案',{exact:true}).click();
 const body=page.locator('.snow-plan-update-body'),footer=page.locator('.snow-plan-update-footer');
 assert.ok((await card.boundingBox()).height<=800,'卡片不得超出视口八成高度');
 assert.ok(await body.evaluate(el=>el.scrollHeight>el.clientHeight),'长内容应在正文内滚动');
 const fixed=await footer.boundingBox();await body.evaluate(el=>{el.scrollTop=el.scrollHeight;});
 assert.equal((await footer.boundingBox()).y,fixed.y,'正文滚动不能移动footer');
 assert.ok(await page.getByRole('button',{name:'确认更新',exact:true}).isVisible());
 await page.setViewportSize({width:390,height:844});
 assert.ok((await card.boundingBox()).height<=844*.8);const mobileFixed=await footer.boundingBox();await body.evaluate(el=>{el.scrollTop=0;});assert.equal((await footer.boundingBox()).y,mobileFixed.y);
 await page.getByText('想调整条件？补充说明',{exact:true}).click();assert.ok((await card.boundingBox()).height<=844*.8);assert.ok((await footer.boundingBox()).y+(await footer.boundingBox()).height<=(await card.boundingBox()).y+(await card.boundingBox()).height);
 await page.getByText('想调整条件？补充说明',{exact:true}).click();await page.getByText('查看调整后的完整方案',{exact:true}).click();

 await page.getByRole('button',{name:'继续调整',exact:true}).click();await page.getByRole('status').filter({hasText:'已选择继续调整 · 未保存'}).waitFor();assert.equal(await card.getAttribute('data-readonly'),'true');assert.equal(await card.getByRole('button').count(),0);assert.match(await card.innerText(),/吉克普林/);
 await page.getByRole('button',{name:'重置检查'}).click();await page.getByRole('button',{name:'另存为新方案',exact:true}).click();assert.match(await card.innerText(),/原方案保留/);assert.equal(await page.evaluate(()=>window.calls),0);await page.getByRole('button',{name:'确认另存',exact:true}).click();await page.getByRole('status').filter({hasText:'已另存为新方案'}).waitFor();assert.equal(await page.evaluate(()=>window.calls),1);assert.equal(await card.getByRole('button').count(),0);
 await page.getByRole('button',{name:'重置检查'}).click();await page.getByRole('button',{name:'确认更新',exact:true}).click();await page.getByRole('status').filter({hasText:'已选择确认更新 · 已更新'}).waitFor();assert.equal(await page.evaluate(()=>window.calls),1);
 await page.getByRole('button',{name:'重置检查'}).click();await page.getByLabel('模拟保存失败').check();await page.getByRole('button',{name:'确认更新',exact:true}).click();await page.getByRole('alert').filter({hasText:'套餐已变化'}).waitFor();assert.match(await card.innerText(),/保存失败 · 原方案未改变/);assert.equal(await card.getByRole('button').count(),0);
 await page.getByRole('button',{name:'重置检查'}).click();await page.getByRole('button',{name:'取消本次操作'}).click();await page.getByRole('status').filter({hasText:'已取消 · 未保存'}).waitFor();
 await page.getByRole('button',{name:'重置检查'}).click();await page.getByText('想调整条件？补充说明',{exact:true}).click();await page.getByLabel('继续补充想法').fill('日期再晚一天');await page.getByRole('button',{name:'发送补充'}).click();await page.getByRole('status').filter({hasText:'已提交补充 · 未保存'}).waitFor();assert.match(await card.innerText(),/日期再晚一天/);
 await page.getByRole('button',{name:'重置检查'}).click();await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.getByText('查看费用与说明变化明细',{exact:true}).click();assert.match(await card.innerText(),/餐饮 ¥100.00/);
 await mkdir('.local',{recursive:true});await page.screenshot({path:'.local/plan-update-check.png',fullPage:true});
 await page.getByRole('button',{name:'检查改名'}).click();await page.getByLabel('模拟保存失败').uncheck();assert.equal(await page.getByRole('button',{name:'另存为新方案',exact:true}).count(),0);assert.match(await card.innerText(),/春节滑雪/);await page.getByRole('button',{name:'确认更新',exact:true}).click();await page.getByRole('status').filter({hasText:'已选择确认更新 · 已更新'}).waitFor();assert.match(await card.innerText(),/禾木滑雪方案/);assert.match(await card.innerText(),/春节滑雪/);assert.equal(await card.getByRole('button').count(),0);
 console.log('更新卡片：继续调整、更新、另存、取消、失败、补充、只读回放和窄屏检查通过');
}finally{await browser.close();}
