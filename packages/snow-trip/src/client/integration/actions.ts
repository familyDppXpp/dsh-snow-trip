import type { SessionId } from '@deepseek-ai/dsh-session/types';
import {
  addRecordReference,
  appendRecordPrompt,
  referenceSource,
  restoreDraftReferences,
} from '../conversation/references.ts';
import {
  continueSnowSession,
  createSnowSession,
  openSnowSession,
  renameSnowSession,
} from '../conversation/sessions.ts';
import type { Actions, Context } from '../integration/types.ts';

export interface WorkbenchLifecycle {
  lastSession?: string;
  close: () => void;
}
export function createWorkbenchActions(
  view: Context,
  selection: Actions['selection'],
  select: (id: string) => void,
  lifecycle: WorkbenchLifecycle,
): Actions {
  const scopeFor = (id?: string) => {
    const scope = id ? view.sessions.scope(id as SessionId) : undefined;
    if (!scope) throw new Error('会话尚未就绪，请重试。');
    return scope;
  };
  return {
    selection,
    referenceAt: (sessionId, index) => {
      const scope = view.sessions.scope(sessionId as SessionId);
      const item =
        scope &&
        view.conversation.input.for(scope).state.getSnapshot().occurrences[
          index
        ];
      return item?.source === referenceSource.name
        ? JSON.parse(item.ref)
        : null;
    },
    restoreReferences: (sessionId) => {
      const scope = view.sessions.scope(sessionId as SessionId);
      if (scope)
        return restoreDraftReferences(
          view.conversation.input.for(scope),
          view.remote.snowTrip,
        );
    },
    addReference: (sessionId, record, type) => {
      const scope = view.sessions.scope(sessionId as SessionId);
      if (!scope) throw new Error('当前会话尚未就绪，请稍后重试。');
      return addRecordReference(
        view.conversation.input.for(scope),
        record,
        type,
      );
    },
    deletePlan: async (id) => {
      const result = await view.remote.snowTrip.deletePlan(id);
      if (!result.ok) throw new Error(result.error.message);
      if (result.value.sessionId === lifecycle.lastSession)
        lifecycle.lastSession = undefined;
      if (result.value.archiveError)
        return `方案已删除，但会话归档失败：${result.value.archiveError}。请从会话菜单重试归档。`;
      return result.value.sessionId
        ? '方案已删除，会话已归档。'
        : '方案已删除。';
    },
    listPlans: async () => {
      const result = await view.remote.snowTrip.listPlans();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    listPackages: async () => {
      const result = await view.remote.snowTrip.listPackages();
      if (!result.ok) throw new Error(result.error.message);
      return result.value;
    },
    deletePackage: async (record, archive, plans = []) => {
      const result = await view.remote.snowTrip.deletePackage(
        record.id,
        record.revision,
        archive,
        plans.map((plan) => plan.id),
      );
      if (!result.ok) throw new Error(result.error.message);
      if (
        result.value.sessionId === lifecycle.lastSession ||
        plans.some((plan) => plan.sessionId === lifecycle.lastSession)
      )
        lifecycle.lastSession = undefined;
      if (result.value.archiveError)
        return `套餐及关联方案已删除，但会话归档失败：${result.value.archiveError}。请从会话菜单重试归档。`;
      return `套餐已删除${plans.length ? `，已一并删除 ${plans.length} 份方案` : ''}${result.value.sessionId ? '，会话已归档' : ''}。`;
    },
    lastSession: () => lifecycle.lastSession,
    sessionState: (id) => view.sessions.binding(id as SessionId)?.session,
    workspaceList: {
      subscribe: (listener: () => void) =>
        view.workspaces.list.subscribe(listener),
      getSnapshot: () => view.workspaces.list.getSnapshot(),
    },
    archive: async (id) => {
      const result = await view.remote.snowTrip.archiveSession(id);
      if (!result.ok) throw new Error(result.error.message);
      if (lifecycle.lastSession === id) lifecycle.lastSession = undefined;
    },
    fork: async (id) => {
      const child = await view.sessions.fork({
        sessionId: id as SessionId,
        increaseTitle: true,
      });
      await view.sessions.refresh();
      openSnowSession(view.sessions, child, select);
      lifecycle.lastSession = child;
      return child;
    },
    rename: (id, title) => renameSnowSession(view.sessions, id, title),
    close: () => lifecycle.close(),
    create: async (draft, record) => {
      const result = await view.remote.snowTrip.ensureWorkspace();
      if (!result.ok)
        throw new Error(`准备工作区失败：${result.error.message}`);
      const workspace = await view.workspaces.create({ path: result.value });
      const id = await createSnowSession(
        view.sessions,
        view.remote.agentPresets,
        view.conversation.input,
        workspace.workspaceId,
        record ? undefined : draft,
        select,
      );
      if (record)
        appendRecordPrompt(
          view.conversation.input.for(scopeFor(id)),
          draft ?? '',
          record,
        );
      lifecycle.lastSession = id;
      return id;
    },
    continueRecord: async (record, prompt) => {
      const opened = await continueSnowSession(
        view.sessions,
        view.conversation.input,
        view.workspaces.list.getSnapshot().archivedSessionIds,
        record.sessionId,
        prompt,
        record,
        select,
      );
      if (opened) lifecycle.lastSession = record.sessionId;
      return opened;
    },
    open: (id) => {
      openSnowSession(view.sessions, id, select);
      lifecycle.lastSession = id;
    },
  };
}
