// 合成宿主记录 + 真实工作台组件；不连接用户宿主或调用模型。
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
assert.ok(process.env.SNOW_REACT_DOM,'请提供 SNOW_REACT_DOM（react-dom/client.js）');
const script=await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './src/workbench.jsx';
import {storage} from './src/storage.js';
const base={sessionId:'fixture-session',updatedAt:'2026-09-25T00:00:00Z',id:'a',name:'合成套餐 A',description:null,hotels:['合成酒店'],resort:null,region:'吉林',nights:3,paid:10000,paidExtra:null,quote:null,purchaseStatus:'purchased',completeness:'incomplete',usedNights:0,validFrom:'2026-12-01',validTo:'2026-12-31',unavailableDates:[],unknowns:[],revision:1};
const rows=[base,{...base,id:'b',name:'合成套餐 B',nights:5,paid:0,purchaseStatus:'unpurchased',completeness:'complete'},{...base,id:'c',name:'合成套餐 C',paid:null,purchaseStatus:'unknown',region:null},{...base,id:'d',name:'合成套餐 D',nights:null,usedNights:null,validFrom:null,paid:20000}];
const workspace={archivedSessionIds:[]};
const actions={lastSession:()=>null,listPackages:async()=>rows,listPlans:async()=>[],workspaceList:{subscribe:()=>()=>{},getSnapshot:()=>workspace}};
window.setLegacy=async present=>{await storage('ledger',present?{fileName:'旧台账.xlsx',packages:[{id:'old',name:'旧套餐',hotel:'旧酒店',resort:'旧雪场',region:'旧地区',nights:2,paid:9999,paidExtra:0,blocked:[],rules:[],split:true}]}:null);};
createRoot(document.getElementById('root')).render(<App useSessions={()=>({ids:[],byId:{}})} actions={actions} renderSlot={()=>null}/>);
`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{react:process.cwd()+'/node_modules/react','react-dom/client':process.env.SNOW_REACT_DOM}});
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{margin:0}</style><style>'+await readFile('src/style.css','utf8')+'</style><div id="root"></div><script>'+script.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></html>';
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 const cards=page.locator('.package-candidates [data-package-id]');
 const ids=()=>cards.evaluateAll(nodes=>nodes.map(n=>n.dataset.packageId));
 await cards.first().waitFor();assert.deepEqual(await ids(),['b','a','c']);
 assert.equal(await page.getByLabel('房间补款上限（元）',{exact:true}).count(),0);
 assert.equal(await page.getByRole('option',{name:'录入顺序',exact:true}).count(),0);
 await page.getByLabel('排序',{exact:true}).selectOption('paid');assert.deepEqual(await ids(),['b','a','c']);
 await page.getByRole('checkbox',{name:'已购买',exact:true}).focus();await page.keyboard.press('Space');
 await page.getByRole('button',{name:'查找方案',exact:true}).click();assert.deepEqual(await ids(),['a']);
 await page.getByRole('checkbox',{name:'未购买',exact:true}).check();
 await page.getByRole('checkbox',{name:'资料完整',exact:true}).check();
 await page.getByRole('button',{name:'查找方案',exact:true}).click();assert.deepEqual(await ids(),['b']);
 await page.getByRole('button',{name:'重置筛选',exact:true}).click();assert.deepEqual(await ids(),['b','a','c']);
 await page.getByLabel('入住日期',{exact:true}).fill('');
 await page.getByRole('checkbox',{name:'待补全',exact:true}).check();
 await page.getByRole('button',{name:'查找方案',exact:true}).click();assert.deepEqual(await ids(),['a','d','c']);
 await page.getByLabel('目的地区域',{exact:true}).selectOption('吉林');
 await page.getByRole('button',{name:'查找方案',exact:true}).click();assert.deepEqual(await ids(),['a','d']);
 await page.getByLabel('搜索套餐或酒店',{exact:true}).fill('不存在');
 await page.getByRole('button',{name:'查找方案',exact:true}).click();assert.equal(await cards.count(),0);
 await page.getByRole('button',{name:'重置筛选',exact:true}).first().click();
 for(const present of [true,false]){
   await page.evaluate(present=>window.setLegacy(present),present);await page.reload();await cards.first().waitFor();
   assert.deepEqual(await ids(),['b','a','c']);
   assert.equal(await page.getByLabel('目的地区域',{exact:true}).getByRole('option',{name:'旧地区'}).count(),0);
 }
 await page.setViewportSize({width:390,height:844});
 const toggle=page.getByRole('button',{name:/筛选出行/});await toggle.click();
 await page.getByRole('checkbox',{name:'待确认',exact:true}).check();
 await page.getByRole('button',{name:'查找方案',exact:true}).click();assert.deepEqual(await ids(),['c']);
 assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 await toggle.click();await page.getByRole('checkbox',{name:'待确认',exact:true}).focus();await page.keyboard.press('Space');
 assert.equal(await page.getByRole('checkbox',{name:'待确认',exact:true}).isChecked(),false);
 assert.equal(await page.locator('.snow-content').evaluate(el=>el.scrollWidth>el.clientWidth),false);
 await mkdir('.local/snow-10',{recursive:true});
 await page.screenshot({path:'.local/snow-10/mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('通过：真实工作台组件筛选、标签组合、排序、重置、旧台账隔离、键盘和 390px 窄屏；未连接真实宿主。');
}finally{try{await browser?.close();}finally{await new Promise(resolve=>server.close(resolve));}}
