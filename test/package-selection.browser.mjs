// 独立卡片验证：勾选移动分组并保持提交值，不操作真实待确认数据。
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {chromium}=await import(process.env.SNOW_PLAYWRIGHT||'playwright');
const reactDom=process.env.SNOW_REACT_DOM_CLIENT||'/Users/liuyunxia/Documents/ai/deepseek-harness/node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/client.js';
const bundle=await build({stdin:{resolveDir:process.cwd(),loader:'jsx',contents:`
import React from 'react';
import {createRoot} from ${JSON.stringify(reactDom)};
import {PlanQuestionCard} from './src/plan-question-card.jsx';
const packages=['甲','乙'].map((name,i)=>({id:String(i),name,purchaseStatus:'purchased',nights:4,completeness:'complete'}));
const pending={questions:[{id:'snow-plan-confirm-test',detail:JSON.stringify({stage:'confirm',key:'test',ids:[],packages})}],answer:async value=>{window.answer=value;}};
createRoot(document.getElementById('root')).render(<PlanQuestionCard pending={pending}/>);
`},bundle:true,write:false,platform:'browser',format:'iife',alias:{react:process.cwd()+'/node_modules/react'},define:{'process.env.NODE_ENV':'"production"'}});
const browser=await chromium.launch({headless:true,executablePath:process.env.SNOW_CHROME});
try{
 const page=await browser.newPage();
 page.setDefaultTimeout(10000);
 page.on("pageerror",error=>console.log(error.message));
 await page.setContent('<div id="root"></div>');
 await page.addScriptTag({content:bundle.outputFiles[0].text});
 const section=page.getByRole('region',{name:'参与搭配的套餐'}),more=section.locator('.snow-plan-more');
 await more.locator('summary').click();
 await more.getByRole('checkbox',{name:/甲/}).click();
 const selected=section.locator(':scope > .snow-plan-package');
 assert.match(await selected.innerText(),/甲/);
 assert.equal(await selected.getByRole("checkbox").isChecked(),true);
 assert.doesNotMatch(await selected.innerText(),/推荐/);
 assert.equal(await more.getByRole('checkbox').count(),1);
 await selected.getByRole('checkbox').click();
 assert.equal(await selected.count(),0);
 assert.equal(await more.getByRole('checkbox').count(),2);
 await more.getByRole('checkbox',{name:/乙/}).click();
 assert.match(await selected.innerText(),/乙/);
 await page.getByRole('button',{name:'生成方案',exact:true}).click();
 await page.waitForFunction(()=>!!window.answer);
 const answer=await page.evaluate(()=>window.answer);
 assert.deepEqual(JSON.parse(answer.answers[0].custom).ids,['1']);
 console.log('通过：勾选移到上方、取消移回更多套餐，手选不标推荐，提交保留选择。');
}finally{await browser.close();}
