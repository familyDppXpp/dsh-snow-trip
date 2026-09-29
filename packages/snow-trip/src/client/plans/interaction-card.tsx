import { useEffect, useRef } from 'react';
import { planMetadata } from '../../shared/plans.ts';
import type { PlanMetadata } from '../conversation/card-types.ts';
import { money } from '../packages/card.tsx';
import { PlanQuestionCard } from './question-card.tsx';
import { PlanSavedCard } from './saved-plan.tsx';
export function PreparedPlanCard({ data }: { data?: PlanMetadata }) {
  const card = useRef<HTMLElement>(null);
  useEffect(() => {
    if (card.current?.getClientRects().length)
      card.current.scrollIntoView({ block: 'start' });
  }, [data?.planningId]);
  const c = data?.conditions;
  if (!['prepared', 'adjusting'].includes(data?.status ?? '') || !c)
    return null;
  const legacy = data.status === 'prepared' && !data.confirmedByCard;
  const confirmed = data.status === 'prepared' && data.confirmedByCard === true;
  const yuan = (n: number) =>
    `¥${(n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return (
    <article
      ref={card}
      className="snow snow-plan-card snow-confirmed-plan"
      aria-label={
        legacy
          ? '历史规划条件'
          : confirmed
            ? '已确认的出行条件'
            : '待调整的出行条件'
      }
    >
      <header>
        <span className="snow-confirmed-status">
          {legacy
            ? '历史记录 · 确认方式未记录'
            : confirmed
              ? '✓ 已确认 · 只读记录'
              : data.custom
                ? '已提交补充 · 未确认'
                : '已取消 · 未确认'}
        </span>
        <h3>
          {legacy
            ? '当时使用的规划条件'
            : confirmed
              ? '本次方案的生成依据'
              : '本次待调整的条件'}
        </h3>
      </header>
      <dl className="snow-confirmed-facts">
        <div>
          <dt>入住日期</dt>
          <dd>{c.start}</dd>
        </div>
        <div>
          <dt>住宿晚数</dt>
          <dd>{c.nights} 晚</dd>
        </div>
        <div>
          <dt>房间数</dt>
          <dd>{c.rooms} 间</dd>
        </div>
        {c.people != null && (
          <div>
            <dt>出行人数</dt>
            <dd>{c.people} 人</dd>
          </div>
        )}
        {c.skiDays != null && (
          <div>
            <dt>滑雪天数</dt>
            <dd>{c.skiDays} 天</dd>
          </div>
        )}
        <div>
          <dt>整趟预算</dt>
          <dd>{c.budget == null ? '不限' : yuan(c.budget)}</dd>
        </div>
      </dl>
      <section>
        <h4>参与搭配的套餐</h4>
        <ul>
          {(data.packages ?? c.packageIds.map((id) => ({ id, name: id }))).map(
            (p) => (
              <li key={p.id}>{p.name}</li>
            ),
          )}
        </ul>
      </section>
      <section>
        <h4>
          {legacy
            ? '当时录入的共同费用'
            : confirmed
              ? '已确认的共同费用'
              : '待确认的共同费用'}
        </h4>
        {c.fees.length ? (
          c.fees.map((f) => (
            <div className="snow-confirmed-fee" key={f.id}>
              <p>
                <strong>{f.label}</strong>
                <span>
                  {f.quantity} × {yuan(f.unitPrice)} ={' '}
                  {yuan(Math.round(f.quantity * f.unitPrice))}
                </span>
              </p>
              <small>
                {f.source === 'estimate'
                  ? confirmed
                    ? '已接受估算'
                    : '待确认估算'
                  : '用户提供'}{' '}
                · {f.basis}
              </small>
            </div>
          ))
        ) : (
          <p>本次未录入共同费用</p>
        )}
      </section>
      {data.custom && (
        <section>
          <h4>你的补充</h4>
          <p style={{ whiteSpace: 'pre-wrap' }}>{data.custom}</p>
        </section>
      )}
      <p className="snow-plan-muted">
        {legacy
          ? '旧记录未保存卡片确认凭据，不能据此认定你已点击确认。'
          : confirmed
            ? '以上为本次确认时的记录。套餐已含权益将在核算时抵扣，费用合计不代表最终整趟成本。'
            : data.custom
              ? '已将补充交给助理继续处理；以上条件与费用尚未确认。'
              : '本次未确认条件与费用，等待继续调整。'}
      </p>
    </article>
  );
}

export function PlanInteractionCard({ data }: { data?: PlanMetadata }) {
  if (data?.interaction?.stage === 'update' && data.interaction.card) {
    const { selection, ...outcome } = data.interaction;
    return (
      <>
        {selection && (
          <PlanQuestionCard
            snapshot={{ ...selection.card, selected: selection.selected }}
            outcome={{ action: 'select' }}
          />
        )}
        <PlanQuestionCard snapshot={outcome.card} outcome={outcome} />
      </>
    );
  }
  if (data?.conditions && ['prepared', 'adjusting'].includes(data.status ?? ''))
    return <PreparedPlanCard data={data} />;
  if (
    data?.version === 1 &&
    data.status === 'saved' &&
    data.plan &&
    !data.interaction?.card?.results?.length
  )
    return (
      <PlanSavedCard
        block={{
          kind: 'tool-result',
          meta: { version: 1, status: 'saved', plan: data.plan },
        }}
      />
    );
  const record =
    data?.interaction ??
    (data?.status === 'save_results'
      ? { action: 'save', stage: 'results', items: data.items }
      : null);
  if (!record) return null;
  if (record.action === 'save') {
    const selected = (record.card?.results ?? []).flatMap((r, i) =>
      record.items?.some(
        (item) => (item.resultId ?? item.planId) === r.resultId,
      )
        ? [i]
        : [],
    );
    return (
      <div className="snow snow-plan-save-record">
        {!!record.card?.results?.length && (
          <PlanQuestionCard
            snapshot={{ ...record.card, stage: 'results', selected }}
            outcome={record}
          />
        )}
        <div className="snow snow-saved-results">
          {record.items?.map((item, i) => {
            let plan: unknown =
              item.plan ?? (data?.plan?.id === item.planId ? data?.plan : null);
            if (!plan && item.status === 'saved') {
              const snapshot = record.card?.results?.find(
                (r) => r.resultId === (item.resultId ?? item.planId),
              );
              if (snapshot) {
                const {
                  resultId,
                  end,
                  checks,
                  switches,
                  estimated,
                  ...stored
                } = snapshot;
                plan = {
                  ...stored,
                  allocation: Array.isArray(stored.allocation)
                    ? stored.allocation.join('\n') || null
                    : stored.allocation,
                  daily: stored.daily?.map(({ hotel, ...row }) => row),
                };
              }
            }
            const meta = { version: 1, status: 'saved', plan };
            return item.status === 'saved' && planMetadata(meta) ? (
              <PlanSavedCard
                key={item.planId ?? i}
                block={{ kind: 'tool-result', meta }}
              />
            ) : (
              <article key={i} className="snow snow-plan-card">
                <h3>
                  {item.title ?? '方案'} ·{' '}
                  {item.status === 'saved' ? '已保存' : '保存失败'}
                </h3>
                <p>
                  {item.status === 'saved'
                    ? '此条历史记录没有完整快照，请到已存方案查看。'
                    : (item.error ?? '请重新检查')}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    );
  }
  if (['cancel', 'supplement'].includes(record.action) && record.card) {
    const stage = record.card.stage ?? record.stage;
    return (
      <PlanQuestionCard
        snapshot={{
          ...record.card,
          stage,
          ...(stage === 'results' ? { selected: [] } : {}),
        }}
        outcome={record}
      />
    );
  }
  const title =
    record.action === 'save'
      ? '方案保存结果'
      : record.action === 'supplement'
        ? '已提交补充'
        : record.action === 'cancel'
          ? '已取消本次操作'
          : '已选择后续操作';
  const c = record.conditions,
    results = record.card?.results ?? [];
  return (
    <article
      className="snow snow-plan-card snow-confirmed-plan"
      aria-label="规划交互记录"
    >
      <header>
        <span className="snow-confirmed-status">只读 · 操作记录</span>
        <h3>{title}</h3>
      </header>
      {c && (
        <p>
          {c.start} 入住 · {c.nights} 晚 · {c.rooms} 间
          {c.people != null ? ` · ${c.people} 人` : ''}
        </p>
      )}
      {results.length > 0 && (
        <section>
          <h4>本次查看的方案</h4>
          <ul>
            {results.map((r, i) => (
              <li key={r.resultId ?? i}>
                {r.title} · {money(r.total)}
              </li>
            ))}
          </ul>
        </section>
      )}
      {record.custom && (
        <section>
          <h4>你的补充</h4>
          <p style={{ whiteSpace: 'pre-wrap' }}>{record.custom}</p>
        </section>
      )}
      {record.action === 'action' && <p>{record.selected?.join('、')}</p>}
      {record.items?.map((item, i) => (
        <p key={i}>
          {item.title ?? '方案'}：
          {item.status === 'saved'
            ? '已保存'
            : `保存失败 · ${item.error ?? '请重新检查'}`}
        </p>
      ))}
      {record.action !== 'save' && (
        <p className="snow-plan-muted">
          {record.stage === 'confirm'
            ? '条件和费用尚未确认。'
            : '本次操作未保存方案。'}
          {record.action === 'supplement' ? '已将补充交给助理继续处理。' : ''}
        </p>
      )}
    </article>
  );
}
