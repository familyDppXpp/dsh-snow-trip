import { useEffect, useState } from 'react';
import type { PlanRecord } from '../integration/types.ts';
import {
  DateFilter,
  Dropdown,
  Option,
  TagFilter,
  TagGroup,
} from '../ui/filters.tsx';
import { Icon } from '../ui/icon.tsx';
import type { PlanFilter } from './filter.ts';
import { planRegions, refundPolicies, tripDays } from './filter.ts';
export function PlanFilters({
  plans,
  value,
  onChange,
  count,
  mobile,
}: {
  plans: PlanRecord[];
  value: PlanFilter;
  onChange: (value: PlanFilter) => void;
  count: number;
  mobile: boolean;
}) {
  const [draft, setDraft] = useState(value),
    [open, setOpen] = useState(false);
  useEffect(() => setDraft(value), [value]);
  const groups: (
    | ['regions' | 'refundPolicy', string, Option[]]
    | ['days', string, Option<number>[]]
    | ['tags', string, TagGroup<'booking' | 'refund'>[]]
  )[] = [
    [
      'regions',
      '出行目的地',
      planRegions(plans).map((region) => [region, region]),
    ],
    ['tags', '方案标签', planTagGroups],
    [
      'refundPolicy',
      '可退策略',
      refundPolicies(plans).map((policy) => [policy, policy]),
    ],
    ['days', '出行天数', tripDays(plans).map((days) => [days, `${days} 天`])],
  ];
  return (
    <section className="search-panel" aria-label="方案筛选">
      {mobile ? (
        <button
          className="snow-filter-toggle"
          aria-expanded={open}
          aria-controls="snow-plan-filters"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon name="search" size={17} />
          <span>
            <strong>筛选方案</strong>
            <small>出行时间 · 目的地 · 方案标签 · 可退策略 · 出行天数</small>
          </span>
          <span aria-hidden="true">{open ? '−' : '＋'}</span>
        </button>
      ) : (
        <div className="section-head">
          <h2>
            <Icon name="search" /> 找一份已存方案
          </h2>
          <span>按出行时间、目的地、状态、策略和天数筛选</span>
        </div>
      )}
      <form
        id="snow-plan-filters"
        hidden={mobile && !open}
        onSubmit={(event) => {
          event.preventDefault();
          onChange(draft);
          setOpen(false);
        }}
      >
        <div className="filter-grid snow-plan-dates">
          <DateFilter
            label="出行时间"
            mode="range"
            start={draft.start}
            end={draft.end}
            onChange={(dates) => setDraft({ ...draft, ...dates })}
          />
        </div>
        <p id="snow-plan-date-hint" className="muted">
          不选日期则不限时间；方案须包含所选完整区间（含首尾日期）。
        </p>
        <div className="filter-grid">
          {groups.map(([key, label, options]) =>
            key === 'tags' ? (
              <TagFilter
                key={key}
                label={label}
                groups={options}
                value={draft}
                onChange={setDraft}
              />
            ) : (
              <Dropdown
                key={key}
                label={label}
                summary={
                  draft[key]
                    .map(
                      (item) =>
                        options.find(([id]) => id === item)?.[1] ?? item,
                    )
                    .join('、') || '全部'
                }
              >
                {() =>
                  options.length ? (
                    options.map(([id, title]) => (
                      <label key={id}>
                        <input
                          type="checkbox"
                          checked={draft[key].some((value) => value === id)}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              [key]: event.target.checked
                                ? [...draft[key], id]
                                : draft[key].filter((item) => item !== id),
                            })
                          }
                        />
                        {title}
                      </label>
                    ))
                  ) : (
                    <p>当前方案暂无{label}</p>
                  )
                }
              </Dropdown>
            ),
          )}
        </div>
        <div className="filter-bottom">
          <span role="status">
            显示 {count} / {plans.length} 份
          </span>
        </div>
        <div className="filter-actions">
          <button className="primary" type="submit">
            <Icon name="search" /> 查找方案
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(emptyPlanFilter);
              onChange(emptyPlanFilter);
            }}
          >
            重置筛选
          </button>
        </div>
      </form>
    </section>
  );
}

export const planTagGroups: TagGroup<'booking' | 'refund'>[] = [
  [
    'booking',
    '预约状态',
    [
      ['confirmed', '已确认'],
      ['unreserved', '未预约'],
      ['', '未设置'],
    ],
  ],
  [
    'refund',
    '退改状态',
    [
      ['refundable', '可退'],
      ['nonrefundable', '不可退'],
      ['', '未设置'],
    ],
  ],
];

export const emptyPlanFilter: PlanFilter = {
  regions: [],
  booking: [],
  refund: [],
  refundPolicy: [],
  days: [],
  start: '',
  end: '',
};
