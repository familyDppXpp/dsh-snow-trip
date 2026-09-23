import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createSnowSession, openSnowSession, snowSessions, sessionTitle, groupSessions, renameSnowSession} from '../src/sessions.js';

test('新建先选预设，草稿不发送，历史只打开雪季会话；失败停止输入', async () => {
  const calls=[];
  const state={byId:{normal:{id:'normal',projectionValues:{agentPreset:'standard'}}}};
  const sessions={
    list:{getSnapshot:()=>state},
    create:async options=>{calls.push(['create',options]);return 'snow';},
    refresh:async()=>{calls.push(['refresh']);},
    open:id=>calls.push(['open',id]),
    scope:id=>({id}),
  };
  const presets={select:async(id,preset)=>{
    calls.push(['select',id,preset]);
    state.byId[id]={id,title:'宿主标题',projectionValues:{agentPreset:preset}};
    return {ok:true,value:null};
  }};
  const input={for:scope=>({setDraft:text=>calls.push(['draft',scope.id,text]),submit:()=>assert.fail('不得自动发送')})};
  assert.equal(await createSnowSession(sessions,presets,input,'workspace','可编辑草稿'),'snow');
  assert.deepEqual(calls,[['create',{workspaceId:'workspace'}],['select','snow','snow-trip'],['refresh'],['open','snow'],['draft','snow','可编辑草稿']]);
  assert.deepEqual(snowSessions(state).map(row=>row.id),['snow']);
  openSnowSession(sessions,'snow');
  assert.deepEqual(calls.at(-1),['open','snow']);
  assert.throws(()=>openSnowSession(sessions,'normal'),/不是雪季/);
  calls.length=0;
  await assert.rejects(createSnowSession(sessions,{select:async()=>({ok:false,error:{message:'预设不存在'}})},input,'workspace','禁止发送'),/预设不存在/);
  assert.deepEqual(calls,[['create',{workspaceId:'workspace'}]]);
});

test('会话标题、套餐分类与搜索使用真实关联，不显示空白会话工作区名',()=>{
  const packages=[{sessionId:'old',completeness:'complete'},{sessionId:'old',completeness:'incomplete'}];
  const rows=[
    {id:'old',displayTitle:'禾木计划',updatedAt:+new Date(2026,8,20)},
    {id:'blank',blank:true,displayTitle:'dsh-snow-trip',updatedAt:+new Date(2026,8,23,10)},
    {id:'yesterday',title:'长白山预算',updatedAt:+new Date(2026,8,22,23)},
    {id:'named',blank:true,title:'我的行程',updatedAt:+new Date(2026,8,23,11)},
  ];
  assert.equal(groupSessions(rows,'',packages)[1].items[0].packageStatus,'待补全');
  assert.equal(groupSessions(rows,'',packages.slice(0,1))[1].items[0].packageStatus,'资料完整');
  assert.equal(groupSessions(rows,'',[])[0].label,'其他');
  assert.deepEqual(groupSessions(rows,'',[])[0].items.map(r=>r.id),['yesterday','old']);
  assert.equal(groupSessions(rows,'',packages)[0].items[0].packageStatus,undefined);
  assert.equal(sessionTitle(rows[1]),'新会话');
  assert.equal(sessionTitle(rows[3]),'我的行程');
  assert.deepEqual(groupSessions(rows,'',packages).map(g=>[g.label,g.items.map(r=>r.id)]),[['其他',['yesterday']],['套餐',['old']]]);
  assert.deepEqual(groupSessions(rows,'  禾木  ',packages)[0].items.map(r=>r.id),['old']);
  assert.deepEqual(groupSessions(rows,'不存在',packages),[]);
  assert.deepEqual(groupSessions(rows,'我的行程',packages),[]);
  assert.equal(groupSessions([{...rows[1],blank:false}], '',packages)[0].items[0].id,'blank');
});

test('编辑标题写入指定宿主会话，空标题和非雪季会话被拒绝，失败不伪装成功',async()=>{
  const calls=[];
  const sessions={list:{getSnapshot:()=>({byId:{snow:{projectionValues:{agentPreset:'snow-trip'}},normal:{projectionValues:{agentPreset:'standard'}}}})},binding:id=>({session:{rename:async title=>{calls.push([id,title]);return {ok:true};}}}),refresh:async()=>calls.push('refresh')};
  await renameSnowSession(sessions,'snow','  长白山行程  ');
  assert.deepEqual(calls,[['snow','长白山行程'],'refresh']);calls.length=0;
  await assert.rejects(renameSnowSession(sessions,'snow','   '),/请输入/);
  await assert.rejects(renameSnowSession(sessions,'normal','改名'),/不是雪季/);
  assert.deepEqual(calls,[]);
  sessions.binding=()=>({session:{rename:async()=>({ok:false,error:{message:'宿主拒绝'}})}});
  await assert.rejects(renameSnowSession(sessions,'snow','改名'),/宿主拒绝/);
  assert.deepEqual(calls,[]);
});

test('宿主确认同步到嵌入视图，移除与卸载镜像不回答原问题',async()=>{
  const {mirrorQuestions}=await import('../src/sessions.js');
  let snapshot=new Map(),listener,removed=0;const published=[];
  const source={getSnapshot:()=>snapshot,subscribe:fn=>{listener=fn;return()=>{listener=null;};}};
  const target={registerPendingInteraction:()=>pending=>{published.push(pending);return()=>removed++;}};
  const stop=mirrorQuestions(source,target);
  const pending={kind:'question',key:'a'};snapshot=new Map([['session',pending]]);listener();listener();
  assert.deepEqual(published,[pending]);snapshot=new Map();listener();assert.equal(removed,1);
  snapshot=new Map([['session',pending]]);listener();stop();assert.equal(removed,2);assert.equal(listener,null);
});

test('打开补全会话只导航，不访问输入框；执行中的会话也可查看',()=>{
 const calls=[];
 const sessions={list:{getSnapshot:()=>({byId:{s:{running:true,projectionValues:{agentPreset:'snow-trip'}}}})},open:id=>calls.push(id),scope:()=>assert.fail('导航不应访问输入框')};
 openSnowSession(sessions,'s');
 assert.deepEqual(calls,['s']);
});
