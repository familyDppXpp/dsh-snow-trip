import type { SessionInputResolver } from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {
  SessionPendingInteraction,
  SessionStatusSnapshot,
} from '@deepseek-ai/dsh-client-ui-session/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { TypertRemoteNamespaceMap } from '@deepseek-ai/dsh-typert-protocol';
import type { WorkspaceId } from '@deepseek-ai/dsh-workspace/types';
import type {
  Context,
  NamedRecord,
  Observable,
  PackageRecord,
  PlanRecord,
  RecordKind,
  SessionListState,
  SessionSummary,
} from '../integration/types.ts';
import { appendRecordPrompt } from './references.ts';
export const SNOW_PRESET = 'snow-trip';

export function sessionTitle(row: SessionSummary) {
  return row.title || (row.blank ? '新会话' : row.displayTitle) || '未命名会话';
}

export function groupSessions(
  rows: SessionSummary[],
  query = '',
  packages: PackageRecord[] = [],
  plans: PlanRecord[] = [],
) {
  const status = new Map();
  for (const p of packages)
    status.set(
      p.sessionId,
      status.get(p.sessionId) === '待补全' || p.completeness === 'incomplete'
        ? '待补全'
        : '资料完整',
    );
  const counts = new Map();
  for (const plan of plans)
    counts.set(plan.sessionId, (counts.get(plan.sessionId) || 0) + 1);
  const groups = new Map<
    string,
    (SessionSummary & { packageStatus?: string; completed?: boolean })[]
  >([
    ['出行方案', []],
    ['套餐', []],
    ['其他', []],
  ]);
  for (const row of [...rows]
    .filter(
      (row) =>
        !row.blank &&
        sessionTitle(row)
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
    )
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))) {
    const packageStatus = status.get(row.id);
    const planCount = counts.get(row.id) || 0;
    groups.get(planCount ? '出行方案' : packageStatus ? '套餐' : '其他')!.push({
      ...row,
      packageStatus: planCount ? `已存 ${planCount} 份` : packageStatus,
    });
  }
  return [...groups]
    .filter(([, items]) => items.length)
    .map(([label, items]) => ({ label, items }));
}

export function snowSessions(state: SessionListState) {
  return (state.ids || Object.keys(state.byId))
    .map((id) => state.byId[id as SessionId])
    .filter((row) => row?.projectionValues?.agentPreset === SNOW_PRESET);
}

export function openSnowSession(
  sessions: Context['sessions'],
  id: string,
  open: (id: string) => void,
) {
  if (
    sessions.list.getSnapshot().byId[id as SessionId]?.projectionValues
      ?.agentPreset !== SNOW_PRESET
  ) {
    throw new Error('该会话不是雪季助理会话，请刷新后重试。');
  }
  open(id);
}

export async function renameSnowSession(
  sessions: Context['sessions'],
  id: string,
  title: string,
) {
  const value = title.trim();
  if (!value) throw new Error('请输入会话标题。');
  if (
    sessions.list.getSnapshot().byId[id as SessionId]?.projectionValues
      ?.agentPreset !== SNOW_PRESET
  )
    throw new Error('该会话不是雪季助理会话。');
  const result = await sessions.using(
    id as SessionId,
    { source: 'snowTrip' },
    async (reference) => {
      await reference.ready;
      return reference.binding.session.rename(value);
    },
  );
  if (!result.ok) throw new Error(result.error.message);
  await sessions.refresh();
}

export async function createSnowSession(
  sessions: Context['sessions'],
  presets: TypertRemoteNamespaceMap['agentPresets'],
  input: SessionInputResolver,
  workspaceId: string,
  draft = '',
  open: (id: string) => void,
) {
  if (!workspaceId) throw new Error('请先选择工作区。');
  const id = await sessions.create({ workspaceId: workspaceId as WorkspaceId });
  const selected = await presets.select(id, SNOW_PRESET);
  if (!selected.ok)
    throw new Error(`雪季预设选择失败：${selected.error.message}`);
  await sessions.refresh();
  openSnowSession(sessions, id, open);
  const scope = sessions.scope(id as SessionId);
  if (!scope) throw new Error('会话尚未就绪，请从历史列表重新打开。');
  if (draft) input.for(scope).setDraft(draft);
  return id;
}

// 两个会话视图共享宿主问题对象；卸载镜像不回答或取消原问题。
export function mirrorQuestions(
  source: Observable<SessionStatusSnapshot>,
  target: Context['uiSession'],
) {
  const publish = target.registerPendingInteraction((pending) =>
    pending.kind === 'plan-review' ? 2 : 1,
  );
  const mirrored = new Map<
    string,
    { pending: SessionPendingInteraction; remove: () => void }
  >();
  const sync = () => {
    const next = source.getSnapshot();
    for (const [id, item] of mirrored)
      if (next.get(id as SessionId)?.pendingInteraction !== item.pending) {
        item.remove();
        mirrored.delete(id);
      }
    for (const [id, { pendingInteraction: pending }] of next)
      if (
        pending &&
        ['question', 'plan-review'].includes(pending.kind) &&
        !mirrored.has(id)
      )
        mirrored.set(id, { pending, remove: publish(pending, async () => {}) });
  };
  const unsubscribe = source.subscribe(sync);
  sync();
  return () => {
    unsubscribe();
    for (const item of mirrored.values()) item.remove();
  };
}

export function packagesForSession(
  packages: PackageRecord[],
  sessionId?: string,
) {
  return packages
    .filter((p) => p.sessionId === sessionId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function continuationPrompt(record: NamedRecord, kind: RecordKind) {
  return JSON.stringify({ type: kind, id: record.id });
}
export async function continueSnowSession(
  sessions: Context['sessions'],
  input: SessionInputResolver,
  archivedIds: readonly string[],
  id: string,
  prompt: string,
  record: NamedRecord,
  open: (id: string) => void,
) {
  await sessions.refresh();
  if (
    archivedIds.includes(id) ||
    sessions.list.getSnapshot().byId[id as SessionId]?.projectionValues
      ?.agentPreset !== SNOW_PRESET
  )
    return false;
  openSnowSession(sessions, id, open);
  const scope = sessions.scope(id as SessionId);
  if (!scope) throw new Error('会话尚未就绪，请重试。');
  appendRecordPrompt(input.for(scope), prompt, record);
  return true;
}
