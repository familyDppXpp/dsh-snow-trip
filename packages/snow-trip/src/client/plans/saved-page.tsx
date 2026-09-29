import { useMemo, useState } from 'react';
import type { PlanRecord } from '../integration/types.ts';
import { usePackages } from '../packages/use-packages.ts';
import { filterPlans, sortPlans } from '../plans/filter.ts';
import { emptyPlanFilter, PlanFilters } from '../plans/filters.tsx';
import { SavedPlan } from '../plans/saved-plan.tsx';
import { SortControl } from '../ui/filters.tsx';
import { Icon, Mountain } from '../ui/icon.tsx';

export function SavedPlansPage({
  active,
  hostSaved,
  plansError,
  plansLoaded,
  host,
  mobile,
  sessionBusy,
  deleteBusy,
  continueRecord,
  startSession,
  onExplore,
  onDelete,
}: {
  active: boolean;
  hostSaved: PlanRecord[];
  plansError: string;
  plansLoaded: boolean;
  host: ReturnType<typeof usePackages>;
  mobile: boolean;
  sessionBusy: boolean;
  deleteBusy: boolean;
  continueRecord: (plan: PlanRecord, kind: 'plan') => void;
  startSession: (draft?: string) => void;
  onExplore: () => void;
  onDelete: (plan: PlanRecord) => void;
}) {
  const [planFilter, setPlanFilter] = useState(emptyPlanFilter);
  const [planSort, setPlanSort] = useState<'nights' | 'total'>('nights'),
    [planSortDirection, setPlanSortDirection] = useState('desc');
  const matchingPlans = useMemo(
    () => filterPlans(hostSaved, planFilter),
    [hostSaved, planFilter],
  );
  const filteredPlans = useMemo(
    () => sortPlans(matchingPlans, planSort, planSortDirection),
    [matchingPlans, planSort, planSortDirection],
  );

  const savedEntrySkill = !host.rows.length
    ? 'snow-import'
    : host.rows.some((record) => record.completeness === 'complete')
      ? 'snow-plan'
      : null;
  if (!active) return null;
  return (
    <>
      <section className="hero snow-saved-title" aria-label="已存方案概览">
        <div className="hero-copy">
          <h1>
            已存方案 <span>{hostSaved.length} 份</span>
          </h1>
          <p>
            回顾每一程的安排与花费。
            <br />
            继续调整时，重新核对套餐与费用。
          </p>
        </div>
        <Mountain />
      </section>
      {plansError && <p role="alert">{plansError}</p>}
      <section className="stats" aria-label="方案总数统计">
        {[
          ['总方案数', hostSaved.length],
          [
            '已确认数',
            hostSaved.filter((plan) => plan.tracking?.booking === 'confirmed')
              .length,
          ],
          [
            '可退款数',
            hostSaved.filter((plan) => plan.tracking?.refund === 'refundable')
              .length,
          ],
          [
            '不可退款数',
            hostSaved.filter(
              (plan) => plan.tracking?.refund === 'nonrefundable',
            ).length,
          ],
        ].map(([label, count]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>
              {!plansLoaded || plansError ? '—' : count}
              <small> 份</small>
            </strong>
          </div>
        ))}
      </section>
      {hostSaved.length > 0 && (
        <PlanFilters
          plans={hostSaved}
          value={planFilter}
          onChange={setPlanFilter}
          count={filteredPlans.length}
          mobile={mobile}
        />
      )}
      {hostSaved.length > 0 && (
        <div className="results-head">
          <div>
            <h2>
              你的已存方案 <span>{filteredPlans.length}</span>
            </h2>
            <p>仅展示符合所选条件的方案</p>
          </div>
          <SortControl
            value={planSort}
            direction={planSortDirection}
            onChange={setPlanSort}
            onDirectionChange={setPlanSortDirection}
            options={[
              ['nights', '出行天数'],
              ['total', '整趟总成本'],
            ]}
          />
        </div>
      )}
      {hostSaved.length > 0 && !filteredPlans.length && (
        <div className="empty">
          <h3>没有符合条件的方案</h3>
          <button onClick={() => setPlanFilter(emptyPlanFilter)}>
            清空筛选
          </button>
        </div>
      )}
      {filteredPlans.map((plan) => (
        <section className="snow-saved-entry" key={plan.id}>
          <SavedPlan plan={plan}>
            <div className="package-actions">
              <button
                className="primary package-open"
                disabled={sessionBusy || deleteBusy}
                onClick={() => continueRecord(plan, 'plan')}
              >
                继续规划 <span aria-hidden="true">→</span>
              </button>
              <button
                className="package-delete"
                disabled={deleteBusy}
                onClick={() => onDelete(plan)}
              >
                删除方案
              </button>
            </div>
          </SavedPlan>
        </section>
      ))}
      {!hostSaved.length && !plansError && (
        <div className="empty">
          <Icon name="save" size={36} />
          <h3>还没有保存的方案</h3>
          <p>已录入套餐可在“已录套餐”中核对。</p>
          <button
            disabled={sessionBusy || host.loading || !!host.error}
            onClick={() =>
              savedEntrySkill
                ? startSession(`/${savedEntrySkill} `)
                : onExplore()
            }
          >
            {host.loading
              ? '正在读取套餐…'
              : host.error
                ? '套餐读取失败'
                : sessionBusy
                  ? '正在准备…'
                  : savedEntrySkill === 'snow-import'
                    ? '录入套餐'
                    : savedEntrySkill === 'snow-plan'
                      ? '规划出行'
                      : '查看已录套餐'}
          </button>
        </div>
      )}
    </>
  );
}
