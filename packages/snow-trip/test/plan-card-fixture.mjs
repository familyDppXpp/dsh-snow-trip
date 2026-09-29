// 生成只含合成数据的交互检查页：node test/plan-card-fixture.mjs。
import {build} from 'esbuild';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const reactDom=process.env.SNOW_REACT_DOM||'/Users/liuyunxia/Documents/ai/deepseek-harness/node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom/client.js';
const script=await build({stdin:{contents:`
import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PlanQuestionCard} from './src/client/plans/question-card.tsx';
import {wireStages,brokenEstimate,pendingStage} from './test/plan-wire-fixtures.mjs';
function Check(){
 const [stage,setStage]=useState('planning'),[answer,setAnswer]=useState(null),[fail,setFail]=useState(false),[calls,setCalls]=useState(0);
 const detail=stage==='planning'?{planning:true,input:{start:'2027-02-06',nights:7,budget:20000,rooms:1,people:2,skiDays:5},fees:[{id:'ski',label:'雪票',quantity:10,unitPrice:35000,basis:'2人各滑5天，待确认单价',source:'estimate'}],packages:[]}:stage==='broken'?brokenEstimate:wireStages[stage];
 const pending=pendingStage(stage==='planning'?'confirm':stage==='broken'?'estimate':stage,detail);
 pending.answer=async value=>{setCalls(n=>n+1);setAnswer(value);if(fail)throw new Error('合成提交失败');};
 return <main className="snow"><label>检查阶段<select value={stage} onChange={e=>{setStage(e.target.value);setAnswer(null);setCalls(0);}}>{Object.keys(wireStages).concat('broken','planning').map(s=><option key={s}>{s}</option>)}</select></label>
 <label><input type="checkbox" checked={fail} onChange={e=>setFail(e.target.checked)}/>模拟提交失败</label>
 <PlanQuestionCard key={stage} pending={pending}/><output aria-label="提交次数">{calls}</output><pre aria-label="回传结果">{JSON.stringify(answer)}</pre></main>;
}
createRoot(document.getElementById('root')).render(<Check/>);`,resolveDir:process.cwd(),loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',alias:{react:process.cwd()+'/node_modules/react','react-dom/client':reactDom}});
await mkdir('.local/plan-card-check',{recursive:true});
await writeFile('.local/plan-card-check/index.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>方案卡片合成检查</title><style>body{margin:16px} main{max-width:860px;margin:auto} textarea{width:100%;box-sizing:border-box} pre{white-space:pre-wrap;overflow-wrap:anywhere}</style><style>'+await readFile('src/client/workbench/style.css','utf8')+'</style><div id="root"></div><script>'+script.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></html>');
console.log('已生成 .local/plan-card-check/index.html');
