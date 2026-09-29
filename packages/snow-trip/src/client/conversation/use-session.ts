import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots';
import { useState, useSyncExternalStore } from 'react';
import { errorMessage } from '../../shared/errors.ts';
import { continuationPrompt, snowSessions } from '../conversation/sessions.ts';
import type {
  Actions,
  PackageRecord,
  PlanRecord,
  RecordKind,
  SessionSummary,
} from '../integration/types.ts';

export function useWorkbenchSession({
  actions,
  useSessions,
  useSessionStatus,
  view,
  setView,
  mobile,
  setMobileMenuOpen,
  setPackageSidebarOpen,
}: {
  actions: Actions;
  useSessions: GlobalStandardProps['useSessions'];
  useSessionStatus: GlobalStandardProps['useSessionStatus'];
  view: string;
  setView: (view: string) => void;
  mobile: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  setPackageSidebarOpen: (open: boolean) => void;
}) {
  const sessions = useSessions((state) => state);
  const statuses = useSessionStatus((state) => state);
  const reference = useSyncExternalStore(
    actions.selection.subscribe,
    actions.selection.getSnapshot,
  );
  const currentId = reference?.sessionId;
  const [sessionBusy, setSessionBusy] = useState(false),
    [sessionError, setSessionError] = useState('');
  const [unavailable, setUnavailable] = useState<{
    prompt: string;
    record: PackageRecord | PlanRecord;
  } | null>(null);
  const [pendingArchive, setPendingArchive] = useState<SessionSummary | null>(
      null,
    ),
    [sessionMenu, setSessionMenu] = useState<{
      row: SessionSummary;
      anchor: HTMLElement;
    } | null>(null);
  const workspaceState = useSyncExternalStore(
    actions.workspaceList.subscribe,
    actions.workspaceList.getSnapshot,
  );
  const [pendingRename, setPendingRename] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const rows = snowSessions(sessions)
      .map((row) => ({
        ...row,
        running: statuses.get(row.id)?.running ?? false,
      }))
      .filter((row) => !workspaceState.archivedSessionIds.includes(row.id)),
    current = rows.find((row) => row.id === currentId);
  const planSessionVersion = rows
    .map((row) => `${row.id}:${row.updatedAt}:${row.running}`)
    .join('|');
  const [sessionQuery, setSessionQuery] = useState('');
  async function startSession(draft?: string) {
    if (sessionBusy) return;
    setSessionError('');
    setSessionQuery('');
    setSessionBusy(true);
    setView('explore');
    try {
      await actions.create(draft);
      setView('conversation');
      setMobileMenuOpen(false);
    } catch (error) {
      setSessionError(errorMessage(error));
    } finally {
      setSessionBusy(false);
    }
  }
  async function archiveSession() {
    if (!pendingArchive || sessionBusy) return;
    const id = pendingArchive.id;
    setSessionBusy(true);
    setSessionError('');
    try {
      await actions.archive(id);
      setPendingArchive(null);
      if (view === 'conversation' && currentId === id) setView('explore');
    } catch (error) {
      setSessionError('归档失败：' + errorMessage(error));
    } finally {
      setSessionBusy(false);
    }
  }
  async function continueRecord(
    record: PackageRecord | PlanRecord,
    kind: RecordKind,
  ) {
    if (sessionBusy) return;
    setSessionBusy(true);
    setSessionError('');
    const prompt = continuationPrompt(record, kind);
    try {
      if (await actions.continueRecord(record, prompt)) {
        setSessionQuery('');
        setPackageSidebarOpen(!mobile);
        setView('conversation');
      } else setUnavailable({ prompt, record });
    } catch (e) {
      setSessionError(errorMessage(e));
    } finally {
      setSessionBusy(false);
    }
  }
  return {
    reference,
    currentId,
    rows,
    current,
    planSessionVersion,
    sessionBusy,
    setSessionBusy,
    sessionError,
    setSessionError,
    unavailable,
    setUnavailable,
    pendingArchive,
    setPendingArchive,
    sessionMenu,
    setSessionMenu,
    pendingRename,
    setPendingRename,
    sessionQuery,
    setSessionQuery,
    startSession,
    archiveSession,
    continueRecord,
  };
}
