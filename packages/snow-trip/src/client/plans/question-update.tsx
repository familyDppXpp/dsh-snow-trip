import { useState } from 'react';
import type { PlanOutcome } from '../conversation/card-types.ts';
import { PlanOptionsBody } from './question-options.tsx';
import { BodyProps, readableBasis, yuan } from './question-shared.tsx';
export function PlanUpdateBody({
  data,
  busy,
  onAnswer,
  cancel,
  readOnly,
  outcome,
  supplement,
  error,
}: BodyProps) {
  const [asNew, setAsNew] = useState(false);
  const copy = readOnly ? outcome?.selected?.[0] === '确认另存' : asNew;
  const table = (
    rows: { label: string; before: string; after: string }[],
    label: string,
  ) => (
    <div className="table-scroll">
      <table aria-label={label}>
        <thead>
          <tr>
            <th scope="col">修改项</th>
            <th scope="col">修改前</th>
            <th scope="col">修改后</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row">{r.label}</th>
              <td style={{ whiteSpace: 'pre-wrap' }}>
                {r.label === '方案名称' ? r.before : readableBasis(r.before)}
              </td>
              <td style={{ whiteSpace: 'pre-wrap' }}>
                {r.label === '方案名称' ? r.after : readableBasis(r.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const details = (data.changes ?? []).filter((r) => r.detail);
  const previous = data.previous?.tracking;
  const booking = { confirmed: '已确认', unreserved: '未预约' },
    refund = { refundable: '可退', nonrefundable: '不可退' };
  return (
    <>
      <div className="snow-plan-update-body">
        {table(
          [
            ...(data.changes ?? []).filter((r) => !r.detail),
            ...(copy && data.copyTitle && data.copyTitle !== data.plan?.title
              ? [
                  {
                    label: '方案名称',
                    before: data.plan?.title ?? '',
                    after: data.copyTitle,
                  },
                ]
              : []),
          ],
          '方案修改前后差异',
        )}
        <p className="snow-plan-pills">
          <strong>{data.costChange}</strong>
        </p>
        {details.length > 0 && (
          <details className="snow-plan-more">
            <summary>查看费用与说明变化明细</summary>
            {table(details, '费用与说明变化明细')}
          </details>
        )}
        {!data.rename && (
          <details className="snow-plan-more">
            <summary>查看调整后的完整方案</summary>
            <PlanOptionsBody
              data={{ stage: 'review', plan: data.plan }}
              readOnly
            />
            {data.plan?.conditions && (
              <p>
                房间数：{data.plan?.conditions.rooms} · 人数：
                {data.plan?.conditions.people ?? '未知'} · 滑雪天数：
                {data.plan?.conditions.skiDays ?? '未知'}
              </p>
            )}
            {data.plan?.packages?.map((p) => (
              <p key={p.id}>
                {p.snapshot?.name} · {p.snapshot?.region} · {p.snapshot?.resort}{' '}
                · {p.snapshot?.hotels?.join('、')}
              </p>
            ))}
            {data.plan?.sharedCosts?.map((c, i) => (
              <p key={i}>
                {c.label}：{yuan(c.amount)} · {readableBasis(c.basis)}
              </p>
            ))}
            {data.plan?.allocation?.map((line, i) => (
              <p key={i}>{readableBasis(line)}</p>
            ))}
          </details>
        )}
        {!data.rename && (
          <aside className="snow-plan-note" aria-label="预约与退改信息处理">
            {copy ? (
              <>
                <strong>另存为新方案</strong>
                <p>原方案保留，新方案的预约、退改状态及策略均为未知。</p>
              </>
            ) : data.resetTracking ? (
              <>
                <strong>预约与退改信息将重置</strong>
                <p>
                  日期、人数、房间数或套餐搭配变化，需重新确认预约和退改条件。
                </p>
                <p>
                  {booking[previous?.booking ?? ('' as keyof typeof booking)] ??
                    '未知'}{' '}
                  → 未知；
                  {refund[previous?.refund ?? ('' as keyof typeof refund)] ??
                    '未知'}{' '}
                  → 未知
                </p>
                {previous?.refundPolicy && (
                  <p>原策略将清空：{previous.refundPolicy}</p>
                )}
              </>
            ) : (
              <>
                <strong>预约与退改信息保留</strong>
                <p>
                  {booking[previous?.booking ?? ('' as keyof typeof booking)] ??
                    '预约状态未知'}{' '}
                  ·{' '}
                  {refund[previous?.refund ?? ('' as keyof typeof refund)] ??
                    '退改状态未知'}
                  {previous?.refundPolicy ? ` · ${previous.refundPolicy}` : ''}
                </p>
              </>
            )}
          </aside>
        )}
      </div>
      {!readOnly && (
        <div className="snow-plan-update-footer">
          {error && <p role="alert">{error}</p>}
          <footer className="snow-plan-actions">
            {cancel}
            {!data.rename && (
              <button
                disabled={busy}
                onClick={() => onAnswer?.({ selected: ['继续调整'] })}
              >
                继续调整
              </button>
            )}
            {!data.rename && (
              <button disabled={busy} onClick={() => setAsNew(!asNew)}>
                {asNew ? '改为更新原方案' : '另存为新方案'}
              </button>
            )}
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                onAnswer?.({ selected: [asNew ? '确认另存' : '确认更新'] })
              }
            >
              {busy ? '正在保存…' : asNew ? '确认另存' : '确认更新'}
            </button>
          </footer>
          {supplement}
        </div>
      )}
    </>
  );
}

export function updateOutcome(outcome: PlanOutcome | undefined) {
  const action = outcome?.selected?.[0];
  if (outcome?.action === 'update')
    return `已选择${action ?? '确认更新'} · ${outcome.status === 'saved' ? (action === '确认另存' ? '已另存为新方案' : '已更新') : '保存失败 · 原方案未改变'}`;
  if (outcome?.action === 'adjust') return '已选择继续调整 · 未保存';
  return outcome?.action === 'cancel'
    ? '已取消 · 未保存'
    : '已提交补充 · 未保存';
}
