import React from 'react';
import { planMetadata } from '../../shared/plans.ts';
import type { ToolBlock } from '../conversation/card-types.ts';
import { PlanFallback } from '../conversation/tool-fallback.tsx';
import type { PlanRecord } from '../integration/types.ts';
export function PlanSavedCard({
  block,
  children,
}: {
  block?: ToolBlock;
  children?: React.ReactNode;
}) {
  const plan =
    block && 'kind' in block && !block.isError
      ? planMetadata(block.meta)
      : null;
  return plan ? (
    <SavedPlan plan={plan}>{children}</SavedPlan>
  ) : (
    <PlanFallback block={block} label="方案保存" />
  );
}

export function SavedPlan({
  plan: meta,
  children,
  heading,
}: {
  plan: PlanRecord;
  children?: React.ReactNode;
  heading?: React.ReactNode;
}) {
  const yuan = (n: number | null | undefined) =>
    n == null
      ? '待确认'
      : `¥${(n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const basis = (text: unknown) =>
    String(text ?? '').replace(/(\d+(?:\.\d+)?)\s*分(?!摊|钟)/g, (_, value) =>
      yuan(Number(value)),
    );
  const nightly =
    meta.daily.length && meta.daily.every((row) => row.amount != null)
      ? meta.daily.reduce((sum, row) => sum + (row.amount ?? 0), 0)
      : null;
  const shared = meta.sharedCosts.reduce(
    (sum, row) => sum + (row.amount ?? 0),
    0,
  );
  return (
    <article
      className="snow trip-card snow-plan-card snow-saved-card"
      aria-label="方案已保存"
      data-plan-id={meta.id}
    >
      <header className="snow-saved-head">
        <div>
          {heading === undefined ? (
            <>
              <span className="snow-saved-label">
                已保存 · {meta.items.length} 个套餐
              </span>
              <h3>{meta.title}</h3>
              {meta.start && (
                <p>
                  {meta.start} 入住
                  {meta.nights !== null ? ` · ${meta.nights} 晚` : ''}
                </p>
              )}
            </>
          ) : (
            heading
          )}
        </div>
        <div className="snow-saved-total">
          <span>整趟总成本</span>
          <strong>{yuan(meta.total)}</strong>
        </div>
      </header>
      {meta.costVersion !== 2 && (
        <p className="snow-plan-note">
          旧补款核算口径 · 保留当时金额；重新出行前请核对补款明细并重新核算。
        </p>
      )}
      {meta.tracking && (
        <div className="snow-plan-tags" aria-label="出行标签">
          {meta.tracking.booking && (
            <span className="snow-session-tag">
              {meta.tracking.booking === 'confirmed' ? '已确认' : '未预约'}
            </span>
          )}
          {meta.tracking.refund && (
            <span className="snow-session-tag">
              {meta.tracking.refund === 'refundable' ? '可退' : '不可退'}
            </span>
          )}
          {meta.tracking.refund === 'refundable' && (
            <p>可退策略：{meta.tracking.refundPolicy}</p>
          )}
        </div>
      )}
      {meta.reason && <p className="snow-saved-reason">{basis(meta.reason)}</p>}
      <section className="snow-saved-breakdown" aria-label="总成本组成">
        <h4>总成本组成</h4>
        <dl>
          <div>
            <dt>
              逐晚费用小计 <small>套餐本价、已付补款及尚需补款，详见下表</small>
            </dt>
            <dd>{yuan(nightly)}</dd>
          </div>
          {meta.sharedCosts.map((cost, index) => (
            <div key={index}>
              <dt>
                {cost.label}
                <small>
                  整趟计一次{cost.basis ? ` · ${basis(cost.basis)}` : ''}
                </small>
              </dt>
              <dd>{yuan(cost.amount)}</dd>
            </div>
          ))}
          <div className="snow-saved-sum">
            <dt>整趟总成本</dt>
            <dd>{yuan(meta.total)}</dd>
          </div>
        </dl>
        {nightly != null &&
        meta.total != null &&
        nightly + shared === meta.total ? (
          <p>
            {yuan(nightly)} 逐晚费用 + {yuan(shared)} 共同费用 ={' '}
            {yuan(meta.total)}
          </p>
        ) : (
          <p>保存时的分项信息不完整或与总额不一致，需重新核对。</p>
        )}
        {meta.allocation && (
          <p className="snow-saved-allocation">
            套餐计入依据：{basis(meta.allocation)}
          </p>
        )}
      </section>
      {meta.costVersion === 2 && (
        <p className="snow-plan-note">
          本次已付补款{' '}
          {yuan(meta.daily.reduce((sum, row) => sum + (row.extraPaid ?? 0), 0))}{' '}
          · 尚需补款{' '}
          {yuan(
            meta.daily.reduce((sum, row) => sum + (row.extraPending ?? 0), 0),
          )}
          （均已计入总成本）
        </p>
      )}
      {meta.daily.length > 0 && (
        <div className="table-scroll snow-saved-daily">
          <table aria-label={`${meta.title} 每日费用`}>
            <thead>
              <tr>
                <th scope="col">日期</th>
                <th scope="col">当晚费用</th>
                <th scope="col">计算依据</th>
              </tr>
            </thead>
            <tbody>
              {meta.daily.map((row) => (
                <tr key={row.date + row.packageId}>
                  <td>{row.date}</td>
                  <td>{yuan(row.amount)}</td>
                  <td>{basis(row.basis)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta.unknowns.length > 0 && (
        <p className="package-missing">
          <span>未知项</span>
          {meta.unknowns.join('、')}
        </p>
      )}
      <small className="snow-saved-footnote">
        费用与套餐资料均为保存时快照
      </small>
      {children}
    </article>
  );
}
