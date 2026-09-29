import { Icon } from '../ui/icon.tsx';
import { SessionRail } from './rail.tsx';

import { useNavigationLayout } from './use-navigation-layout.ts';
export const navigationTabs = [
  ['home', 'calendar', '首页'],
  ['explore', 'grid', '已录套餐'],
  ['saved', 'save', '已存方案'],
];
export function NavigationRail({
  layout,
  view,
  packageCount,
  planCount,
  onNavigate,
  onClose,
  children,
  menu,
}: {
  layout: ReturnType<typeof useNavigationLayout>;
  view: string;
  packageCount: number;
  planCount: number;
  onNavigate: (view: string) => void;
  onClose: () => void;
  children: React.ReactNode;
  menu: React.ReactNode;
}) {
  const {
    railSize,
    mobileMenuOpen,
    setMobileMenuOpen,
    mobile,
    railMax,
    drag,
    resizeRail,
  } = layout;
  const tabs = navigationTabs;
  const goHome = () => {
    onNavigate('home');
    setMobileMenuOpen(false);
  };
  return (
    <>
      {' '}
      {mobile && (
        <header className="snow snow-mobile-topbar">
          <button
            aria-label="打开菜单"
            aria-expanded={mobileMenuOpen}
            aria-controls="snow-sidebar"
            onClick={() => setMobileMenuOpen(true)}
          >
            ☰ <span>菜单</span>
          </button>
        </header>
      )}
      <SessionRail
        mobile={mobile}
        open={mobileMenuOpen}
        onClose={onClose}
        width={railSize.width}
      >
        <aside className="rail" id="snow-sidebar">
          <button
            className="brand"
            onClick={goHome}
            aria-label="雪季出行，返回首页"
          >
            <div className="brand-mark">
              <Icon size={27} />
            </div>
            <div>
              <b>雪季出行</b>
              <small>我的山野计划</small>
            </div>
          </button>
          <div className="season-label">26 / 27 雪季</div>
          <nav aria-label="工作台导航">
            {tabs.map(([id, icon, label]) => (
              <button
                key={id}
                className={view === id ? 'active' : ''}
                aria-current={view === id ? 'page' : undefined}
                onClick={() => {
                  onNavigate(id);
                  setMobileMenuOpen(false);
                }}
              >
                <Icon name={icon} />
                <span>{label}</span>
                {id === 'explore' && <em>{packageCount}</em>}
                {id === 'saved' && planCount > 0 && <em>{planCount}</em>}
              </button>
            ))}
          </nav>
          {children}
          <div className="rail-bottom">
            <div className="local-dot" />
            <span>数据保存在本机</span>
          </div>
        </aside>
        <div
          className="snow-rail-resizer"
          role="separator"
          aria-label="调整侧边栏宽度"
          aria-orientation="vertical"
          aria-controls="snow-sidebar"
          aria-valuemin={145}
          aria-valuemax={railMax}
          aria-valuenow={railSize.width}
          tabIndex={0}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            event.currentTarget.focus();
            drag.current = { x: event.clientX, width: railSize.width };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (drag.current)
              resizeRail(drag.current.width + event.clientX - drag.current.x);
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
              ArrowLeft: railSize.width - 10,
              ArrowRight: railSize.width + 10,
              Home: 145,
              End: railMax,
            }[event.key];
            if (next !== undefined) {
              event.preventDefault();
              resizeRail(next);
            }
          }}
        />
        {menu}
      </SessionRail>
    </>
  );
}
