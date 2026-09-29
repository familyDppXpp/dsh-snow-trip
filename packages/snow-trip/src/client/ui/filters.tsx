import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { DatePickerProps } from './date-picker.tsx';
import { DatePicker } from './date-picker.tsx';
import { Icon } from './icon.tsx';
export function Dropdown({
  label,
  labelIcon,
  summary,
  children,
  popupClass = '',
  minWidth = 220,
  triggerRef,
}: {
  label: string;
  labelIcon?: string;
  summary: string;
  children: (close: () => void, id: string, open: boolean) => React.ReactNode;
  popupClass?: string;
  minWidth?: number;
  triggerRef?: React.MutableRefObject<HTMLButtonElement | null>;
}) {
  const id = useId(),
    popup = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  useLayoutEffect(() => {
    if (!open) return;
    const menu = popup.current!,
      rect = trigger.current!.getBoundingClientRect();
    menu.style.width =
      Math.min(Math.max(rect.width, minWidth), window.innerWidth - 16) + 'px';
    menu.style.left =
      Math.max(
        8,
        Math.min(rect.left, window.innerWidth - menu.offsetWidth - 8),
      ) + 'px';
    menu.style.top =
      (rect.bottom + 6 + menu.offsetHeight <= window.innerHeight - 8
        ? rect.bottom + 6
        : Math.max(8, rect.top - menu.offsetHeight - 6)) + 'px';
  }, [open, minWidth]);
  useEffect(() => {
    const menu = popup.current!,
      toggled = (event: Event) =>
        setOpen((event as ToggleEvent).newState === 'open');
    menu.addEventListener('toggle', toggled);
    return () => menu.removeEventListener('toggle', toggled);
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (
        event.type === 'resize' ||
        !popup.current?.contains(event.target as Node)
      )
        popup.current?.hidePopover();
    };
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open]);
  return (
    <div className="field package-tag-filter">
      <label htmlFor={id + '-trigger'} title={labelIcon ? label : undefined}>
        {labelIcon ? <Icon name={labelIcon} /> : label}
      </label>
      <button
        id={id + '-trigger'}
        ref={(node) => {
          trigger.current = node;
          if (triggerRef) triggerRef.current = node;
        }}
        type="button"
        className="package-tag-trigger"
        aria-label={label + '：' + summary}
        aria-expanded={open}
        popovertarget={id}
        onClick={(event) => {
          event.preventDefault();
          setOpen(!popup.current!.matches(':popover-open'));
          popup.current?.togglePopover();
        }}
      >
        <span>{summary}</span>
      </button>
      <div
        id={id}
        ref={popup}
        popover="auto"
        className={`snow package-tag-options ${popupClass}`}
        role="group"
        aria-label={label + '选项'}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            popup.current?.hidePopover();
            trigger.current?.focus();
          }
        }}
      >
        {children(
          () => {
            popup.current?.hidePopover();
            trigger.current?.focus();
          },
          id,
          open,
        )}
      </div>
    </div>
  );
}

export function Select<T extends string>({
  label,
  labelIcon,
  value,
  options,
  onChange,
}: {
  label: string;
  labelIcon?: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <Dropdown
      label={label}
      labelIcon={labelIcon}
      summary={options.find(([key]) => key === value)?.[1] ?? value}
    >
      {(close, id) => (
        <div role="radiogroup" aria-label={label}>
          {options.map(([key, title]) => (
            <label key={key}>
              <input
                type="radio"
                name={id}
                value={key}
                checked={value === key}
                onChange={() => onChange(key)}
                onClick={close}
              />
              {title}
            </label>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

export function TagFilter<K extends string, T extends Record<K, string[]>>({
  label,
  groups,
  value,
  onChange,
}: {
  label: string;
  groups: TagGroup<K>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const selected = groups.flatMap(([key, groupLabel, options]) =>
    value[key].map((item) =>
      item === ''
        ? `${groupLabel}未设置`
        : (options.find(([id]) => id === item)?.[1] ?? item),
    ),
  );
  return (
    <Dropdown label={label} summary={selected.join('、') || '全部标签'}>
      {() =>
        groups.map(([key, groupLabel, options]) => (
          <div role="group" aria-label={groupLabel} key={key}>
            {options.map(([id, title]) => (
              <label key={id}>
                <input
                  type="checkbox"
                  checked={value[key].includes(id)}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      [key]: event.target.checked
                        ? [...value[key], id]
                        : value[key].filter((item) => item !== id),
                    })
                  }
                />
                {title}
              </label>
            ))}
          </div>
        ))
      }
    </Dropdown>
  );
}

export function SortControl<T extends string>({
  value,
  direction,
  onChange,
  onDirectionChange,
  options,
}: {
  value: T;
  direction: string;
  onChange: (value: T) => void;
  onDirectionChange: React.Dispatch<React.SetStateAction<string>>;
  options: Option<T>[];
}) {
  return (
    <div className="snow-package-sort">
      <button
        type="button"
        className="snow-sort-direction"
        aria-label={
          direction === 'desc' ? '当前降序，切换为升序' : '当前升序，切换为降序'
        }
        title={
          direction === 'desc' ? '当前降序，切换为升序' : '当前升序，切换为降序'
        }
        onClick={() =>
          onDirectionChange((value) => (value === 'desc' ? 'asc' : 'desc'))
        }
      >
        <Icon name={direction === 'desc' ? 'sort' : 'sortAsc'} />
      </button>
      <Select
        label="排序"
        value={value}
        options={options}
        onChange={onChange}
      />
    </div>
  );
}

export function DateFilter({
  label,
  mode = 'single',
  start,
  end,
  onChange,
  triggerRef,
}: Omit<DatePickerProps, 'mode' | 'onClose'> & {
  label: string;
  mode?: 'single' | 'range';
  triggerRef?: React.MutableRefObject<HTMLButtonElement | null>;
}) {
  return (
    <Dropdown
      label={label}
      summary={
        start ? (mode === 'range' ? `${start} 至 ${end}` : start) : '不限日期'
      }
      minWidth={320}
      popupClass="snow-date-popover"
      triggerRef={triggerRef}
    >
      {(close, id, open) =>
        open && (
          <DatePicker
            mode={mode}
            start={start}
            end={end}
            onChange={onChange}
            onClose={close}
          />
        )
      }
    </Dropdown>
  );
}

export type Option<T = string> = [T, string];

export type TagGroup<T extends string = string> = [T, string, Option[]];
