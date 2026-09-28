// 合成记录驱动真实工作台与模板组件，不连接用户宿主或发送消息。
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
assert.ok(process.env.SNOW_REACT_DOM,'请提供 SNOW_REACT_DOM');
const script=await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './src/client/workbench.jsx';
import {DepartureHero} from './src/client/departure.jsx';
const mode=new URLSearchParams(location.search).get('mode');
const rows=mode==='empty'?[]:(mode==='mixed'?['incomplete','complete']:['incomplete']).map((completeness,i)=>({id:String(i),sessionId:'old',name:'测试套餐',completeness,updatedAt:'2026-09-25',nights:null,paid:null,paidExtra:null,region:null}));
const workspace={archivedSessionIds:[]},state={ids:[],byId:{}},draft={draft:''};
const input={state:{subscribe:()=>()=>{},getSnapshot:()=>draft}};
window.created=[];
const actions={lastSession:()=>null,sessionState:()=>null,listPlans:async()=>[],listPackages:async()=>{if(mode==='error')throw Error('测试读取失败');return rows;},workspaceList:{subscribe:()=>()=>{},getSnapshot:()=>workspace},create:async text=>{
 window.created.push(text);draft.draft=text||'';
 state.current='new';state.ids=['new'];state.byId.new={id:'new',blank:true,projectionValues:{agentPreset:'snow-trip'}};
}};
const useSessions=select=>select(state);
createRoot(document.getElementById('root')).render(<App useSessions={useSessions} actions={actions} renderSlot={()=> <div data-phase="hero"><DepartureHero useSessions={useSessions} inputFor={()=>input}/></div>}/>);
`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{react:process.cwd()+'/node_modules/react','react-dom/client':process.env.SNOW_REACT_DOM}});
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<meta charset="utf-8"><div id="root"></div><script>'+script.outputFiles[0].text+'</script>');});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const [mode,label,skill] of [['empty','录入套餐','snow-import'],['incomplete','查看已录套餐',null],['mixed','规划出行','snow-plan'],['error','套餐读取失败',null]]){
  await page.goto('http://127.0.0.1:'+server.address().port+'/?mode='+mode);
  await page.getByRole('button',{name:'已存方案',exact:true}).click();
  const button=page.locator('.empty').getByRole('button',{name:label,exact:true});
  await button.waitFor();
  if(mode==='error'){assert.equal(await button.isDisabled(),true);continue;}
  await button.click();
  if(skill){
   await page.locator('.snow-departure-shortcuts button[aria-pressed="true"]').waitFor();
   assert.deepEqual(await page.evaluate(()=>window.created),['/'+skill+' ']);
   assert.match(await page.locator('.snow-departure-shortcuts button[aria-pressed="true"]').innerText(),skill==='snow-import'?/录入套餐/:/规划出行/);
  }else{
   await page.getByRole('heading',{name:/你的出行候选/}).waitFor();
   assert.deepEqual(await page.evaluate(()=>window.created),[]);
  }
 }
 assert.deepEqual(errors,[]);
 console.log('通过：空套餐、仅待补全、混合完整套餐、读取失败，以及新会话模板自动选中。');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
