import { useEffect, useRef } from 'react';
import { Children } from './modal.tsx';
export function Menu({
  anchor,
  onClose,
  children,
  label = '会话操作',
  compact = false,
}: Children & {
  anchor: HTMLElement;
  onClose: () => void;
  label?: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const menu = ref.current!;
    const toggled = (event: Event) => {
      if ((event as ToggleEvent).newState === 'closed') onClose();
    };
    menu.addEventListener('toggle', toggled);
    menu.showPopover();
    const rect = anchor.getBoundingClientRect();
    const left = Math.max(
      8,
      Math.min(
        compact ? rect.right - menu.offsetWidth : rect.left,
        window.innerWidth - menu.offsetWidth - 8,
      ),
    );
    const top =
      rect.bottom + 6 + menu.offsetHeight <= window.innerHeight - 8
        ? rect.bottom + 6
        : Math.max(8, rect.top - menu.offsetHeight - 6);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.querySelector('button')?.focus();
    const close = () => {
      menu.hidePopover();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      menu.removeEventListener('toggle', toggled);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [anchor, compact]);
  return (
    <div
      ref={ref}
      popover="auto"
      className={`snow snow-session-menu${compact ? ' snow-record-menu' : ''}`}
      role="menu"
      aria-label={label}
      onKeyDown={(event) => {
        const buttons = [...ref.current!.querySelectorAll('button')],
          index = buttons.findIndex(
            (button) => button === document.activeElement,
          );
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          buttons[
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (index +
                    (event.key === 'ArrowDown' ? 1 : -1) +
                    buttons.length) %
                  buttons.length
          ]?.focus();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          ref.current?.hidePopover();
          anchor.focus();
        } else if (event.key === 'Tab') {
          ref.current?.hidePopover();
          anchor.focus();
        }
      }}
    >
      {children}
    </div>
  );
}
