import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../shared/errors.ts';
import { purchaseLabels } from '../../shared/packages.ts';
import type {
  NamedRecord,
  PackageRecord,
  PlanRecord,
  RecordKind,
} from '../integration/types.ts';
import { SavedPlan } from '../plans/saved-plan.tsx';
import { Icon } from '../ui/icon.tsx';
import { Menu } from '../ui/menu.tsx';
import { Children } from '../ui/modal.tsx';
import { PackageDetails } from './details.tsx';

export const PackageSidebarContext = createContext<{
  available: boolean;
  open: boolean;
  toggle: () => void;
} | null>(null);

export function PackageSidebarToggle() {
  const panel = useContext(PackageSidebarContext);
  if (!panel?.available) return null;
  return (
    <span className="snow">
      <button
        className="icon-button snow-header-button"
        aria-label={panel.open ? '收起套餐详情' : '展开套餐详情'}
        title={panel.open ? '收起套餐详情' : '展开套餐详情'}
        aria-expanded={panel.open}
        aria-controls="snow-package-sidebar"
        onClick={panel.toggle}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M15 4v16" />
        </svg>
      </button>
    </span>
  );
}

export function PackageDrawer({
  children,
  onClose,
}: Children & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      className="snow-package-drawer"
      ref={dialog}
      aria-label="套餐详情"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

export function PackageSidebar({
  records,
  plans = [],
  allPackages = records,
  onBack,
  missing = false,
  expanded = false,
  onAdd,
  onClose,
  error,
  loading,
  onRetry,
  width,
  onWidth,
}: SidebarProps) {
  const [tab, setTab] = useState(plans.length ? 'plans' : 'packages'),
    [reference, setReference] = useState<{
      entry: PlanRecord['packages'][number];
      plan: PlanRecord;
    } | null>(null),
    [latest, setLatest] = useState(false);
  const activeTab =
    tab === 'plans'
      ? plans.length
        ? 'plans'
        : 'packages'
      : records.length
        ? 'packages'
        : 'plans';
  const categories: [string, string, number][] = [
    ['packages', '套餐', records.length],
    ['plans', '方案', plans.length],
  ];
  const availableCategories = categories.filter(([, , count]) => count > 0);
  const [recordMenu, setRecordMenu] = useState<{
      record: NamedRecord;
      kind: RecordKind;
      anchor: HTMLButtonElement;
    } | null>(null),
    [referenceNotice, setReferenceNotice] = useState(''),
    [referenceError, setReferenceError] = useState('');
  const menuButton = (record: NamedRecord, kind: RecordKind) =>
    onAdd && (
      <button
        className="snow-record-menu-button"
        aria-label={`操作：${record.name ?? record.title}`}
        title="更多操作"
        aria-haspopup="menu"
        aria-expanded={
          recordMenu?.record.id === record.id && recordMenu?.kind === kind
        }
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setRecordMenu({ record, kind, anchor: event.currentTarget });
        }}
      >
        ···
      </button>
    );
  const currentPackage =
    reference && allPackages.find((p) => p.id === reference.entry.id);
  const shown = reference
    ? [latest && currentPackage ? currentPackage : reference.entry.snapshot]
    : activeTab === 'packages'
      ? records
      : [];
  const openReference = (
    entry: PlanRecord['packages'][number],
    plan: PlanRecord,
  ) => {
    setReference({ entry, plan });
    setLatest(false);
  };
  const PackageContainer = expanded ? 'article' : 'details',
    PackageHeading = expanded ? 'header' : 'summary';

  const panel = useRef<HTMLElement>(null),
    drag = useRef<{ x: number; width: number } | null>(null);
  const [maxWidth, setMaxWidth] = useState(600);
  useEffect(() => {
    const layout = panel.current!.parentElement!;
    const measure = () =>
      setMaxWidth(
        Math.max(
          0,
          Math.min(
            600,
            layout.clientWidth - (window.innerWidth > 1150 ? 280 : 0),
          ),
        ),
      );
    const observer = new ResizeObserver(measure);
    observer.observe(layout);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  const minWidth = Math.min(280, maxWidth),
    shownWidth = Math.max(minWidth, Math.min(width, maxWidth));
  const resize = (value: number) =>
    onWidth(Math.max(minWidth, Math.min(value, maxWidth)));

  return (
    <aside
      className="snow snow-package-sidebar"
      ref={panel}
      style={{ width: shownWidth }}
      id="snow-package-sidebar"
      aria-label="关联详情"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        className="snow-package-resizer"
        role="separator"
        aria-label="调整套餐详情宽度"
        aria-orientation="vertical"
        aria-controls="snow-package-sidebar"
        aria-valuemin={minWidth}
        aria-valuemax={maxWidth}
        aria-valuenow={shownWidth}
        tabIndex={0}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          drag.current = { x: event.clientX, width: shownWidth };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current)
            resize(drag.current.width + drag.current.x - event.clientX);
        }}
        onPointerUp={(event) => {
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onLostPointerCapture={() => {
          drag.current = null;
        }}
        onKeyDown={(event) => {
          const next = {
            ArrowLeft: shownWidth + 10,
            ArrowRight: shownWidth - 10,
            Home: minWidth,
            End: maxWidth,
          }[event.key];
          if (next !== undefined) {
            event.preventDefault();
            resize(next);
          }
        }}
      />
      <div className="snow-package-sidebar-head">
        <h2>{reference || expanded ? '套餐详情' : '关联详情'}</h2>
        <button
          className="icon-button snow-header-button"
          title="收起套餐详情"
          aria-label="收起套餐详情"
          onClick={onClose}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="snow-package-sidebar-body">
        {onBack && (
          <button className="snow-reference-back" onClick={onBack}>
            ← 返回关联资料
          </button>
        )}
        {error && (
          <p className="error" role="alert">
            详情刷新失败，以下为上次读取的内容。
            <button onClick={onRetry}>重试</button>
          </p>
        )}
        {loading && <p role="status">正在刷新…</p>}
        {!expanded && !reference && availableCategories.length > 0 && (
          <div className="snow-detail-tabs" aria-label="详情分类">
            {availableCategories.map(([id, label, count]) =>
              availableCategories.length === 1 ? (
                <span className="snow-detail-category" key={id}>
                  {label} <span className="snow-detail-count">{count}</span>
                </span>
              ) : (
                <button
                  key={id}
                  aria-pressed={activeTab === id}
                  onClick={() => setTab(id)}
                >
                  {label} <span className="snow-detail-count">{count}</span>
                </button>
              ),
            )}
          </div>
        )}
        {reference && (
          <div className="snow-reference-nav">
            <button
              className="snow-reference-back"
              onClick={() => {
                setReference(null);
                setTab('plans');
              }}
            >
              <span aria-hidden="true">←</span>返回方案
            </button>
            <div className="snow-reference-meta">
              <p>
                {latest && currentPackage ? '最新资料' : '方案保存时快照'} · 第{' '}
                {
                  (latest && currentPackage
                    ? currentPackage
                    : reference.entry.snapshot
                  ).revision
                }{' '}
                版
              </p>
              {currentPackage &&
                (currentPackage.revision === reference.entry.revision ? (
                  <span className="snow-reference-current">
                    <Icon name="check" size={14} />
                    已是最新资料
                  </span>
                ) : (
                  <button
                    className="snow-reference-switch"
                    onClick={() => setLatest((value) => !value)}
                  >
                    {latest ? '查看保存时快照' : '查看最新资料'}
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
            </div>
            {!currentPackage && !loading && !error && (
              <p className="snow-reference-missing">
                原套餐已删除，仍可查看保存时快照。
              </p>
            )}
          </div>
        )}
        {!reference &&
          activeTab === 'plans' &&
          plans.map((plan, index) => (
            <details
              className="snow-detail-package snow-detail-plan"
              key={plan.id}
              open={index === 0 ? true : undefined}
            >
              <summary>
                <span>
                  <strong>{plan.title}</strong>
                  <small className="snow-detail-meta">
                    <span>
                      {plan.start ? `${plan.start} 入住` : '日期待确认'}
                      {plan.nights !== null ? ` · ${plan.nights} 晚` : ''}
                    </span>
                    <span className="snow-session-tag">已保存</span>
                  </small>
                </span>
                {menuButton(plan, 'plan')}
              </summary>
              <SavedPlan
                plan={plan}
                heading={
                  <section
                    className="snow-plan-packages"
                    aria-label="引用的套餐"
                  >
                    <h4>引用的套餐</h4>
                    {plan.packages.map((entry) => (
                      <button
                        key={entry.id}
                        aria-label={`查看套餐：${entry.snapshot.name} · 第 ${entry.revision} 版`}
                        onClick={() => openReference(entry, plan)}
                      >
                        <span className="snow-plan-package-copy">
                          <strong>{entry.snapshot.name}</strong>
                          <small>保存时资料 · 第 {entry.revision} 版</small>
                        </span>
                        <span
                          className="snow-plan-package-arrow"
                          aria-hidden="true"
                        >
                          →
                        </span>
                      </button>
                    ))}
                  </section>
                }
              />
            </details>
          ))}
        {!reference && !plans.length && !records.length && (
          <p role="status">
            {missing ? '该资料已删除或暂不可用。' : '该会话暂无关联资料。'}
          </p>
        )}
        {shown.map((record, index) => (
          <PackageContainer
            className="snow-detail-package"
            key={record.id}
            open={!expanded && index === 0 ? true : undefined}
          >
            <PackageHeading>
              <span>
                <strong>{record.name}</strong>
                <small className="snow-detail-meta">
                  <span>{purchaseLabels[record.purchaseStatus]}</span>
                  <span className="snow-session-tag">
                    {record.completeness === 'incomplete'
                      ? '待补全'
                      : '资料完整'}
                  </span>
                </small>
              </span>
              {menuButton(
                reference ? (currentPackage ?? record) : record,
                'package',
              )}
            </PackageHeading>
            <PackageDetails record={record} expanded={expanded} />
          </PackageContainer>
        ))}
      </div>
      {referenceNotice && (
        <p className="snow-reference-feedback" role="status">
          {referenceNotice}
        </p>
      )}
      {referenceError && (
        <p className="snow-reference-feedback error" role="alert">
          {referenceError}
        </p>
      )}
      {recordMenu && (
        <Menu
          anchor={recordMenu.anchor}
          label="资料操作"
          compact
          onClose={() => setRecordMenu(null)}
        >
          <button
            role="menuitem"
            onClick={() => {
              setReferenceError('');
              setReferenceNotice('');
              try {
                const added = onAdd?.(recordMenu.record, recordMenu.kind);
                setReferenceNotice(
                  added ? '已添加到当前会话输入框。' : '输入框已包含这项资料。',
                );
              } catch (error) {
                setReferenceError(errorMessage(error));
              } finally {
                recordMenu.anchor.focus();
                setRecordMenu(null);
              }
            }}
          >
            <span className="snow-menu-add" aria-hidden="true">
              ＋
            </span>
            添加到会话
          </button>
        </Menu>
      )}
    </aside>
  );
}

export type SidebarProps = {
  records: PackageRecord[];
  plans?: PlanRecord[];
  allPackages?: PackageRecord[];
  onBack?: () => void;
  missing?: boolean;
  expanded?: boolean;
  onAdd?: (record: NamedRecord, kind: RecordKind) => boolean;
  onClose: () => void;
  error: string;
  loading: boolean;
  onRetry: () => void;
  width: number;
  onWidth: (width: number) => void;
};
