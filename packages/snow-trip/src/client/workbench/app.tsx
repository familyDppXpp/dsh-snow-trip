import type {
  GlobalStandardProps,
  PropsRenderSlots,
  SessionProviderComponent,
} from '@deepseek-ai/dsh-client-ui-slots';
import { useEffect, useState } from 'react';
import { HomeCalendar } from '../calendar/home-calendar.tsx';
import { ConversationPanel } from '../conversation/panel.tsx';
import {
  SessionActionsMenu,
  SessionControls,
  SessionDialogs,
} from '../conversation/session-controls.tsx';
import { packagesForSession } from '../conversation/sessions.ts';
import { useWorkbenchSession } from '../conversation/use-session.ts';
import type {
  Actions,
  PackageRecord,
  PlanRecord,
  RecordReference,
} from '../integration/types.ts';
import { PackageComparison } from '../packages/comparison.tsx';
import { DeletePackageDialog } from '../packages/delete-dialog.tsx';
import { PackageExplorePage } from '../packages/explore-page.tsx';
import {
  PackageDrawer,
  PackageSidebar,
  PackageSidebarContext,
} from '../packages/sidebar.tsx';
import { usePackageExplorer } from '../packages/use-explorer.ts';
import { DeletePlanDialog } from '../plans/delete-dialog.tsx';
import { SavedPlansPage } from '../plans/saved-page.tsx';
import { Icon } from '../ui/icon.tsx';
import { NavigationRail, navigationTabs } from './navigation.tsx';
import { useNavigationLayout } from './use-navigation-layout.ts';
import { useWorkbenchRecords } from './use-records.ts';

export function App({
  useSessions,
  useSessionStatus,
  renderSlot,
  SessionProvider,
  actions,
}: AppProps) {
  const layout = useNavigationLayout();
  const { mobile, setMobileMenuOpen } = layout;

  const [packageSidebarOpen, setPackageSidebarOpen] = useState(() => !mobile);
  const [view, setView] = useState('home');
  const session = useWorkbenchSession({
    actions,
    useSessions,
    useSessionStatus,
    view,
    setView,
    mobile,
    setMobileMenuOpen,
    setPackageSidebarOpen,
  });
  const {
    reference,
    currentId,
    current,
    planSessionVersion,
    sessionBusy,
    setSessionMenu,
    startSession,
    continueRecord,
  } = session;
  const [inspectedPackage, setInspectedPackage] = useState<string | null>(null);
  const [clickedReference, setClickedReference] =
    useState<RecordReference | null>(null);
  useEffect(() => setClickedReference(null), [currentId]);
  const [packageSidebarWidth, setPackageSidebarWidth] = useState(340);
  const [packageDrawerWidth, setPackageDrawerWidth] = useState(560);
  const [pendingDelete, setPendingDelete] = useState<{
      record: PackageRecord;
      plans: PlanRecord[];
      archive: boolean;
    } | null>(null),
    [deleteBusy, setDeleteBusy] = useState(false);
  const [pendingPlanDelete, setPendingPlanDelete] = useState<PlanRecord | null>(
    null,
  );

  const [notice, setNotice] = useState('');
  const records = useWorkbenchRecords(actions, view, planSessionVersion);
  const {
    host,
    hostSaved,
    setHostSaved,
    plansError,
    plansLoaded,
    setPlansRefresh,
    ledger,
    loading,
    error,
  } = records;
  useEffect(() => {
    setPackageSidebarOpen(!mobile);
  }, [mobile, view, current?.id]);
  useEffect(() => {
    if (view === 'conversation' && current)
      return actions.restoreReferences?.(current.id);
  }, [view, current?.id, actions]);
  useEffect(() => {
    if (!loading && view === 'conversation' && !current) setView('explore');
  }, [loading, view, current?.id]);

  const explorer = usePackageExplorer({
    ledger,
    records: host.rows,
    hostSaved,
    plansLoaded,
    plansError,
    setNotice,
  });
  const sessionPackages = packagesForSession(host.rows, current?.id);
  const sessionPlans = hostSaved.filter(
    (plan) => plan.sessionId === current?.id,
  );
  const panelPackages = clickedReference
    ? host.rows.filter(
        (row) =>
          clickedReference.type === 'package' && row.id === clickedReference.id,
      )
    : sessionPackages;
  const panelPlans = clickedReference
    ? hostSaved.filter(
        (row) =>
          clickedReference.type === 'plan' && row.id === clickedReference.id,
      )
    : sessionPlans;
  const closeInspectedPackage = () => {
    const id = inspectedPackage;
    setInspectedPackage(null);
    requestAnimationFrame(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          `[data-package-id="${id}"] .package-inspect`,
        ),
      ]
        .find((button) => button.getClientRects().length)
        ?.focus(),
    );
  };

  const openPackage = (record: PackageRecord) =>
    continueRecord(record, 'package');

  return (
    <PackageSidebarContext.Provider
      value={{
        available:
          !!clickedReference ||
          sessionPackages.length > 0 ||
          sessionPlans.length > 0,
        open: packageSidebarOpen,
        toggle: () => setPackageSidebarOpen((open) => !open),
      }}
    >
      <div
        className={`snow-workbench${view === 'home' ? ' snow-home-active' : ''}`}
      >
        <NavigationRail
          layout={layout}
          view={view}
          packageCount={host.rows.length}
          planCount={hostSaved.length}
          onNavigate={setView}
          onClose={() => {
            setMobileMenuOpen(false);
            setSessionMenu(null);
          }}
          menu={
            <>
              {' '}
              <SessionActionsMenu
                session={session}
                records={records}
                layout={layout}
                actions={actions}
                setView={setView}
              />
            </>
          }
        >
          {' '}
          <SessionControls
            session={session}
            records={records}
            layout={layout}
            actions={actions}
            view={view}
            setView={setView}
            setPackageSidebarOpen={setPackageSidebarOpen}
          />
        </NavigationRail>
        <div
          className="snow snow-content"
          hidden={view === 'conversation' && !!current}
        >
          <main className="workspace">
            <header className="topbar">
              <div>
                <span className="crumb">我的雪季</span>
                <span className="separator">/</span>
                {navigationTabs.find((t) => t[0] === view)?.[2]}
              </div>
              <button onClick={() => startSession()} disabled={sessionBusy}>
                <Icon name="edit" />
                {sessionBusy ? '正在准备…' : '开始录入'}
              </button>
            </header>
            <div className="page">
              <div
                aria-live="polite"
                className={`feedback ${notice ? 'visible' : ''}`}
              >
                {notice}
              </div>
              {error && (
                <div role="alert" className="notice error">
                  {error}
                </div>
              )}
              <HomeCalendar
                active={view === 'home'}
                host={host}
                plans={hostSaved}
                plansLoading={!plansLoaded}
                plansError={plansError}
                onRetryPlans={() => setPlansRefresh((n) => n + 1)}
                onStart={() => startSession()}
                busy={sessionBusy}
              />
              <PackageExplorePage
                active={view === 'explore'}
                explorer={explorer}
                host={host}
                ledger={ledger}
                plansError={plansError}
                mobile={mobile}
                startSession={startSession}
                sessionBusy={sessionBusy}
                onInspect={setInspectedPackage}
                openPackage={openPackage}
                onRetryPlans={() => setPlansRefresh((n) => n + 1)}
                onDelete={(record) => {
                  const plans = hostSaved.filter((plan) =>
                    plan.packages.some((entry) => entry.id === record.id),
                  );
                  setPendingDelete({
                    record,
                    plans,
                    archive:
                      !host.rows.some(
                        (p) =>
                          p.id !== record.id &&
                          p.sessionId === record.sessionId,
                      ) &&
                      !hostSaved.some(
                        (p) =>
                          p.sessionId === record.sessionId &&
                          !plans.some((plan) => plan.id === p.id),
                      ),
                  });
                }}
              />
              <SavedPlansPage
                active={view === 'saved'}
                hostSaved={hostSaved}
                plansError={plansError}
                plansLoaded={plansLoaded}
                host={host}
                mobile={mobile}
                sessionBusy={sessionBusy}
                deleteBusy={deleteBusy}
                continueRecord={continueRecord}
                startSession={startSession}
                onExplore={() => setView('explore')}
                onDelete={(plan) => {
                  setPendingPlanDelete(plan);
                }}
              />
              <footer className="page-footer">
                <span>雪季出行工作台</span>
                <span>
                  {ledger
                    ? '来源：' + ledger.fileName
                    : '文字录入 · 核对后保存'}
                </span>
              </footer>
            </div>
            <PackageComparison
              active={view === 'explore'}
              explorer={explorer}
            />
          </main>
        </div>
        {(view === 'explore' || view === 'home') &&
          inspectedPackage &&
          host.rows.some((record) => record.id === inspectedPackage) && (
            <PackageDrawer onClose={closeInspectedPackage}>
              <PackageSidebar
                key={inspectedPackage}
                expanded
                records={host.rows.filter(
                  (record) => record.id === inspectedPackage,
                )}
                width={packageDrawerWidth}
                onWidth={setPackageDrawerWidth}
                error={host.error}
                loading={host.loading}
                onRetry={host.retry}
                onClose={closeInspectedPackage}
              />
            </PackageDrawer>
          )}
        {view === 'conversation' && current && (
          <ConversationPanel
            actions={actions}
            currentId={current.id}
            reference={reference}
            SessionProvider={SessionProvider}
            renderSlot={renderSlot}
            onReference={setClickedReference}
            onOpenSidebar={() => setPackageSidebarOpen(true)}
          >
            {packageSidebarOpen &&
              (clickedReference ||
                sessionPackages.length > 0 ||
                sessionPlans.length > 0) && (
                <PackageSidebar
                  key={
                    current.id +
                    (clickedReference?.type ?? '') +
                    (clickedReference?.id ?? '')
                  }
                  onBack={
                    clickedReference
                      ? () => setClickedReference(null)
                      : undefined
                  }
                  missing={!!clickedReference}
                  width={packageSidebarWidth}
                  onWidth={setPackageSidebarWidth}
                  onAdd={(record, kind) =>
                    actions.addReference(current.id, record, kind)
                  }
                  records={panelPackages}
                  plans={panelPlans}
                  allPackages={host.rows}
                  error={host.error || plansError}
                  loading={host.loading}
                  onRetry={() => {
                    host.retry();
                    setPlansRefresh((n) => n + 1);
                  }}
                  onClose={() => setPackageSidebarOpen(false)}
                />
              )}
          </ConversationPanel>
        )}
        <SessionDialogs session={session} actions={actions} setView={setView} />

        {pendingPlanDelete && (
          <DeletePlanDialog
            plan={pendingPlanDelete}
            plans={hostSaved}
            packages={host.rows}
            busy={deleteBusy}
            onBusy={setDeleteBusy}
            deletePlan={actions.deletePlan}
            onClose={() => setPendingPlanDelete(null)}
            onDeleted={(id, message) => {
              setHostSaved((rows) => rows.filter((plan) => plan.id !== id));
              setNotice(message);
              setPlansRefresh((n) => n + 1);
            }}
          />
        )}
        {pendingDelete && (
          <DeletePackageDialog
            pending={pendingDelete}
            busy={deleteBusy}
            onBusy={setDeleteBusy}
            deletePackage={actions.deletePackage}
            onDeleted={setNotice}
            onRefresh={() => {
              host.retry();
              setPlansRefresh((n) => n + 1);
            }}
            onClose={() => setPendingDelete(null)}
          />
        )}
      </div>
    </PackageSidebarContext.Provider>
  );
}

export type AppProps = Pick<
  GlobalStandardProps,
  'useSessions' | 'useSessionStatus'
> &
  PropsRenderSlots<'main'> & {
    actions: Actions;
    SessionProvider: SessionProviderComponent;
  };
