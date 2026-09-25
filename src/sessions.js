export const SNOW_PRESET = 'snow-trip';

export function sessionTitle(row) {
  return row.title || (row.blank ? '新会话' : row.displayTitle) || '未命名会话';
}

export function groupSessions(rows, query='', packages=[], plans=[]) {
  const status=new Map();
  for(const p of packages)status.set(p.sessionId,status.get(p.sessionId)==='待补全'||p.completeness==='incomplete'?'待补全':'资料完整');
  const counts=new Map();
  for(const plan of plans)counts.set(plan.sessionId,(counts.get(plan.sessionId)||0)+1);
  const groups=new Map([['其他',[]],['套餐',[]],['出行方案',[]]]);
  for(const row of [...rows].filter(row=>!row.blank&&sessionTitle(row).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))) {
    const packageStatus=status.get(row.id);
    const planCount=counts.get(row.id)||0;
    groups.get(planCount?'出行方案':packageStatus?'套餐':'其他').push({...row,packageStatus:planCount?`已存 ${planCount} 份`:packageStatus});
  }
  return [...groups].filter(([,items])=>items.length).map(([label,items])=>({label,items}));
}

export function snowSessions(state) {
  return (state.ids||Object.keys(state.byId)).map(id=>state.byId[id]).filter(row=>row?.projectionValues?.agentPreset===SNOW_PRESET);
}

export function openSnowSession(sessions, id) {
  if (sessions.list.getSnapshot().byId[id]?.projectionValues?.agentPreset!==SNOW_PRESET) {
    throw new Error('该会话不是雪季助理会话，请刷新后重试。');
  }
  sessions.open(id);
}

export async function renameSnowSession(sessions,id,title) {
  const value=title.trim();
  if(!value)throw new Error('请输入会话标题。');
  if(sessions.list.getSnapshot().byId[id]?.projectionValues?.agentPreset!==SNOW_PRESET)throw new Error('该会话不是雪季助理会话。');
  const session=sessions.binding(id)?.session;
  if(!session)throw new Error('会话不存在，请刷新后重试。');
  const result=await session.rename(value);
  if(!result.ok)throw new Error(result.error.message);
  await sessions.refresh();
}

export async function createSnowSession(sessions, presets, input, workspaceId, draft='') {
  if (!workspaceId) throw new Error('请先选择工作区。');
  const id = await sessions.create({workspaceId});
  const selected = await presets.select(id, SNOW_PRESET);
  if (!selected.ok) throw new Error(`雪季预设选择失败：${selected.error.message}`);
  await sessions.refresh();
  openSnowSession(sessions, id);
  const scope = sessions.scope(id);
  if (!scope) throw new Error('会话尚未就绪，请从历史列表重新打开。');
  if (draft) input.for(scope).setDraft(draft);
  return id;
}

// 两个会话视图共享宿主问题对象；卸载镜像不回答或取消原问题。
export function mirrorQuestions(source, target) {
  const publish=target.registerPendingInteraction(pending=>pending.kind==='plan-review'?2:1);
  const mirrored=new Map();
  const sync=()=>{
    const next=source.getSnapshot();
    for(const [id,item] of mirrored)if(next.get(id)!==item.pending){item.remove();mirrored.delete(id);}
    for(const [id,pending] of next)if(['question','plan-review'].includes(pending.kind)&&!mirrored.has(id))mirrored.set(id,{pending,remove:publish(pending,async()=>{})});
  };
  const unsubscribe=source.subscribe(sync);sync();
  return()=>{unsubscribe();for(const item of mirrored.values())item.remove();};
}

export function packagesForSession(packages,sessionId) {
  return packages.filter(p=>p.sessionId===sessionId).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
}

export function continuationPrompt(record,kind) {
  return kind==='plan'?`请加载 snow-plan，回顾已存方案“${record.title}”（ID：${record.id}），在保留原方案的基础上继续调整。`:`请查询套餐“${record.name}”（ID：${record.id}）的最新资料，继续补充信息，修改后请让我确认再保存。`;
}
export async function continueSnowSession(sessions,input,archivedIds,id,prompt) {
  await sessions.refresh();
  if(archivedIds.includes(id)||sessions.list.getSnapshot().byId[id]?.projectionValues?.agentPreset!==SNOW_PRESET)return false;
  openSnowSession(sessions,id);
  const scope=sessions.scope(id);
  if(!scope)throw new Error('会话尚未就绪，请重试。');
  const target=input.for(scope),draft=target.state.getSnapshot().draft;
  if(!draft.includes(prompt))target.setDraft(draft?`${draft}\n\n${prompt}`:prompt);
  return true;
}
