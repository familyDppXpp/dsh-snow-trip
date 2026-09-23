export const SNOW_PRESET = 'snow-trip';

export function sessionTitle(row) {
  return row.title || (row.blank ? '新会话' : row.displayTitle) || '未命名会话';
}

export function groupSessions(rows, query='', now=new Date()) {
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const yesterday=new Date(today);yesterday.setDate(today.getDate()-1);
  const groups=new Map();
  for(const row of [...rows].filter(row=>!row.blank&&sessionTitle(row).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))) {
    const label=row.updatedAt>=+today?'今天':row.updatedAt>=+yesterday?'昨天':'更早';
    if(!groups.has(label))groups.set(label,[]);
    groups.get(label).push(row);
  }
  return [...groups].map(([label,items])=>({label,items}));
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
