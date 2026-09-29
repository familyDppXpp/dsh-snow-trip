import { useEffect, useRef, useState } from 'react';
import { groupSessions, sessionTitle } from '../conversation/sessions.ts';
import type {
  PackageRecord,
  PlanRecord,
  SessionSummary,
} from '../integration/types.ts';
import { Icon } from '../ui/icon.tsx';

export function SessionList({
  rows,
  packages,
  plans,
  active,
  currentId,
  compactRail,
  sessionBusy,
  sessionQuery,
  setSessionQuery,
  menuSessionId,
  error,
  loading,
  onRetry,
  onOpen,
  onMenu,
}: {
  rows: SessionSummary[];
  packages: PackageRecord[];
  plans: PlanRecord[];
  active: boolean;
  currentId?: string;
  compactRail: boolean;
  sessionBusy: boolean;
  sessionQuery: string;
  setSessionQuery: (query: string) => void;
  menuSessionId?: string;
  error: string;
  loading: boolean;
  onRetry: () => void;
  onOpen: (id: string) => void;
  onMenu: (row: SessionSummary, anchor: HTMLElement) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({});
  const sessionList = useRef<HTMLDivElement>(null);
  const sessionGroups = groupSessions(rows, sessionQuery, packages, plans);
  useEffect(() => {
    if (active)
      sessionList.current
        ?.querySelector('[aria-current="page"]')
        ?.scrollIntoView({ block: 'nearest' });
  }, [active, currentId]);
  return (
    <>
      {' '}
      <div className="snow-session-search">
        <Icon name="search" size={14} />
        <input
          aria-label="搜索会话"
          placeholder="搜索会话标题"
          value={sessionQuery}
          onChange={(event) => setSessionQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape' && sessionQuery) {
              event.preventDefault();
              event.stopPropagation();
              setSessionQuery('');
            }
          }}
        />
        {sessionQuery && (
          <button aria-label="清空会话搜索" onClick={() => setSessionQuery('')}>
            <Icon name="close" size={12} />
          </button>
        )}
      </div>
      <div
        className="snow-session-list"
        aria-label="雪季会话列表"
        ref={sessionList}
      >
        {error ? (
          <div className="snow-session-empty" role="alert">
            会话分类加载失败<button onClick={onRetry}>重试</button>
          </div>
        ) : loading ? (
          <div className="snow-session-empty" role="status">
            正在加载会话分类…
          </div>
        ) : !sessionGroups.length ? (
          <div className="snow-session-empty">
            <p>{sessionQuery ? '没有匹配的会话' : '还没有会话'}</p>
            <small>
              {sessionQuery
                ? '换个关键词，或清空搜索。'
                : '点击“出发去山野”，一起安排这次出行。'}
            </small>
          </div>
        ) : (
          sessionGroups.map((group) => (
            <section
              className="snow-session-group"
              key={group.label}
              aria-label={group.label}
            >
              <h3>
                <button
                  className="snow-group-toggle"
                  aria-expanded={
                    !!sessionQuery.trim() || !collapsedGroups[group.label]
                  }
                  onClick={() =>
                    setCollapsedGroups({
                      ...collapsedGroups,
                      [group.label]: !collapsedGroups[group.label],
                    })
                  }
                >
                  <span aria-hidden="true">
                    {!sessionQuery.trim() && collapsedGroups[group.label]
                      ? '▸'
                      : '▾'}
                  </span>
                  {group.label}
                  <span className="snow-group-count">{group.items.length}</span>
                </button>
              </h3>
              {(sessionQuery.trim() || !collapsedGroups[group.label]) &&
                group.items.map((row) => {
                  const title = sessionTitle(row),
                    selected = active && row.id === currentId;
                  return (
                    <div
                      className={`snow-session-row${selected ? ' is-current' : ''}`}
                      key={row.id}
                      data-session-id={row.id}
                    >
                      <button
                        className="snow-session-open"
                        title={title}
                        aria-current={selected ? 'page' : undefined}
                        disabled={sessionBusy}
                        onClick={() => onOpen(row.id)}
                      >
                        <span className="snow-session-heading">
                          <strong>{title}</strong>
                          {row.packageStatus && !compactRail && (
                            <span className="snow-session-tag">
                              {row.packageStatus}
                            </span>
                          )}
                        </span>
                        <span className="snow-session-meta">
                          {row.packageStatus && compactRail && (
                            <span className="snow-session-tag snow-session-compact-tag">
                              {row.packageStatus}
                            </span>
                          )}
                          <span
                            className={
                              row.running
                                ? 'is-running'
                                : !row.completed && !row.blank
                                  ? 'snow-session-idle'
                                  : ''
                            }
                          >
                            {row.running
                              ? '正在执行'
                              : row.completed
                                ? '已完成'
                                : row.blank
                                  ? '尚未开始'
                                  : '可继续'}
                          </span>
                          {!!row.updatedAt && (
                            <time
                              dateTime={new Date(row.updatedAt).toISOString()}
                              title={new Date(row.updatedAt).toLocaleString(
                                'zh-CN',
                              )}
                            >
                              {new Date(row.updatedAt).toLocaleString(
                                'zh-CN',
                                new Date(row.updatedAt).toDateString() !==
                                  new Date().toDateString()
                                  ? { month: 'numeric', day: 'numeric' }
                                  : { hour: '2-digit', minute: '2-digit' },
                              )}
                            </time>
                          )}
                        </span>
                      </button>
                      <div className="snow-session-actions">
                        <button
                          aria-label={`会话操作：${title}`}
                          title="会话操作"
                          disabled={sessionBusy}
                          aria-haspopup="menu"
                          aria-expanded={menuSessionId === row.id}
                          onClick={(event) => onMenu(row, event.currentTarget)}
                        >
                          ···
                        </button>
                      </div>
                    </div>
                  );
                })}
            </section>
          ))
        )}
      </div>
    </>
  );
}
