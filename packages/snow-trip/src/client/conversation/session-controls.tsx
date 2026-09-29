import { errorMessage } from '../../shared/errors.ts';
import { RenameSessionDialog } from './rename-dialog.tsx';
import { SessionList } from './session-list.tsx';
import { sessionTitle } from './sessions.ts';
import type { Actions } from '../integration/types.ts';
import { Icon } from '../ui/icon.tsx';
import { Menu } from '../ui/menu.tsx';
import { Modal } from '../ui/modal.tsx';
import type { useNavigationLayout } from '../workbench/use-navigation-layout.ts';
import type { useWorkbenchRecords } from '../workbench/use-records.ts';
import type { useWorkbenchSession } from './use-session.ts';

type SessionUIProps = {
  session: ReturnType<typeof useWorkbenchSession>;
  records: ReturnType<typeof useWorkbenchRecords>;
  layout: ReturnType<typeof useNavigationLayout>;
  actions: Actions;
  view: string;
  setView: (view: string) => void;
  setPackageSidebarOpen: (open: boolean) => void;
};

export function SessionControls({
  session,
  records,
  layout,
  actions,
  view,
  setView,
  setPackageSidebarOpen,
}: SessionUIProps) {
  const {
    rows,
    current,
    sessionBusy,
    sessionError,
    setSessionError,
    sessionMenu,
    setSessionMenu,
    sessionQuery,
    setSessionQuery,
    startSession,
  } = session;
  const { host, hostSaved, plansError, setPlansRefresh } = records;
  const { mobile, compactRail, setMobileMenuOpen } = layout;
  return (
    <>
      <section className="snow-session-controls" aria-label="助理会话">
        <button
          className="snow-session-new"
          disabled={sessionBusy}
          onClick={() => startSession()}
        >
          <span aria-hidden="true">＋</span>
          {sessionBusy ? '正在准备…' : '出发去山野'}
        </button>
        {current?.blank && view !== 'conversation' && (
          <button
            onClick={() => {
              setView('conversation');
              setMobileMenuOpen(false);
            }}
          >
            继续未发送的会话
          </button>
        )}
        {sessionError && (
          <p className="error" role="alert">
            {sessionError}
          </p>
        )}
        <SessionList
          rows={rows}
          packages={host.rows}
          plans={hostSaved}
          active={view === 'conversation'}
          currentId={current?.id}
          compactRail={compactRail}
          sessionBusy={sessionBusy}
          sessionQuery={sessionQuery}
          setSessionQuery={setSessionQuery}
          menuSessionId={sessionMenu?.row.id}
          error={host.error || plansError}
          loading={host.loading && !host.rows.length}
          onRetry={() => {
            host.retry();
            setPlansRefresh((n) => n + 1);
          }}
          onMenu={(row, anchor) => setSessionMenu({ row, anchor })}
          onOpen={(id) => {
            try {
              actions.open(id);
              if (mobile) setPackageSidebarOpen(false);
              setView('conversation');
              setMobileMenuOpen(false);
              setSessionError('');
            } catch (error) {
              setSessionError(errorMessage(error));
            }
          }}
        />
      </section>
    </>
  );
}
export function SessionActionsMenu({
  session,
  records,
  layout,
  actions,
  setView,
}: Pick<
  SessionUIProps,
  'session' | 'records' | 'layout' | 'actions' | 'setView'
>) {
  const {
    setSessionBusy,
    setSessionError,
    setPendingArchive,
    sessionMenu,
    setSessionMenu,
    setPendingRename,
    setSessionQuery,
  } = session;
  const { host, hostSaved, plansError, plansLoaded } = records;
  const { setMobileMenuOpen } = layout;
  return (
    <>
      {sessionMenu && (
        <Menu anchor={sessionMenu.anchor} onClose={() => setSessionMenu(null)}>
          <button
            role="menuitem"
            onClick={() => {
              setPendingRename({
                id: sessionMenu.row.id,
                title: sessionTitle(sessionMenu.row),
              });
              setSessionMenu(null);
            }}
          >
            <Icon name="edit" />
            重命名
          </button>
          <button
            role="menuitem"
            onClick={async () => {
              const id = sessionMenu.row.id;
              setSessionMenu(null);
              setSessionBusy(true);
              setSessionError('');
              try {
                await actions.fork(id);
                setSessionQuery('');
                setView('conversation');
                setMobileMenuOpen(false);
              } catch (error) {
                setSessionError('分叉失败：' + errorMessage(error));
              } finally {
                setSessionBusy(false);
              }
            }}
          >
            <Icon name="fork" />
            分叉会话
          </button>
          {!host.loading &&
            !host.error &&
            plansLoaded &&
            !plansError &&
            !host.rows.some(
              (record) => record.sessionId === sessionMenu.row.id,
            ) &&
            !hostSaved.some(
              (plan) => plan.sessionId === sessionMenu.row.id,
            ) && (
              <button
                role="menuitem"
                onClick={() => {
                  setSessionError('');
                  setPendingArchive(sessionMenu.row);
                  setSessionMenu(null);
                }}
              >
                <Icon name="archive" />
                归档会话
              </button>
            )}
        </Menu>
      )}
    </>
  );
}
export function SessionDialogs({
  session,
  actions,
  setView,
}: Pick<SessionUIProps, 'session' | 'actions' | 'setView'>) {
  const {
    sessionBusy,
    setSessionBusy,
    sessionError,
    setSessionError,
    unavailable,
    setUnavailable,
    pendingArchive,
    setPendingArchive,
    pendingRename,
    setPendingRename,
    archiveSession,
  } = session;

  return (
    <>
      {unavailable && (
        <Modal
          title="原会话不可用"
          dismissible={!sessionBusy}
          onClose={() => setUnavailable(null)}
        >
          <p>原会话已归档或不存在。可新建会话继续，原资料保留。</p>
          {sessionError && <p role="alert">{sessionError}</p>}
          <div className="modal-actions">
            <button disabled={sessionBusy} onClick={() => setUnavailable(null)}>
              取消
            </button>
            <button
              className="primary"
              disabled={sessionBusy}
              onClick={async () => {
                if (sessionBusy) return;
                setSessionBusy(true);
                setSessionError('');
                try {
                  await actions.create(unavailable.prompt, unavailable.record);
                  setUnavailable(null);
                  setView('conversation');
                } catch (e) {
                  setSessionError(errorMessage(e));
                } finally {
                  setSessionBusy(false);
                }
              }}
            >
              新建会话继续
            </button>
          </div>
        </Modal>
      )}
      {pendingRename && (
        <RenameSessionDialog
          initialTitle={pendingRename.title}
          busy={sessionBusy}
          onBusy={setSessionBusy}
          onRename={(title) => actions.rename(pendingRename.id, title)}
          onClose={() => setPendingRename(null)}
        />
      )}
      {pendingArchive && (
        <Modal
          title="归档会话"
          dismissible={!sessionBusy}
          onClose={() => setPendingArchive(null)}
        >
          <p>确定归档“{sessionTitle(pendingArchive)}”吗？</p>
          <p className="muted">
            归档后，会话将从列表中收起，聊天记录保留。正在执行的任务不受影响。
          </p>
          {sessionError && (
            <p className="error" role="alert">
              {sessionError}
            </p>
          )}
          <div className="modal-actions">
            <button
              autoFocus
              disabled={sessionBusy}
              onClick={() => setPendingArchive(null)}
            >
              取消
            </button>
            <button
              className="primary"
              disabled={sessionBusy}
              onClick={archiveSession}
            >
              {sessionBusy ? '正在归档…' : '确认归档'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
