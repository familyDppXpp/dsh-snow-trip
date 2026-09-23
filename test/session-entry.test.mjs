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

test('会话标题、时间分组与搜索使用真实状态，不显示空白会话工作区名',()=>{
  const now=new Date(2026,8,23,12);
  const rows=[
    {id:'old',displayTitle:'禾木计划',updatedAt:+new Date(2026,8,20)},
    {id:'blank',blank:true,displayTitle:'dsh-snow-trip',updatedAt:+new Date(2026,8,23,10)},
    {id:'yesterday',title:'长白山预算',updatedAt:+new Date(2026,8,22,23)},
    {id:'named',blank:true,title:'我的行程',updatedAt:+new Date(2026,8,23,11)},
  ];
  assert.equal(sessionTitle(rows[1]),'新会话');
  assert.equal(sessionTitle(rows[3]),'我的行程');
  assert.deepEqual(groupSessions(rows,'',now).map(g=>[g.label,g.items.map(r=>r.id)]),[['昨天',['yesterday']],['更早',['old']]]);
  assert.deepEqual(groupSessions(rows,'  禾木  ',now)[0].items.map(r=>r.id),['old']);
  assert.deepEqual(groupSessions(rows,'不存在',now),[]);
  assert.deepEqual(groupSessions(rows,'我的行程',now),[]);
  assert.equal(groupSessions([{...rows[1],blank:false}], '',now)[0].items[0].id,'blank');
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
