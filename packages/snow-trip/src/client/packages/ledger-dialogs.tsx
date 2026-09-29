import React, { useState } from 'react';
import { yuan } from '../ui/format.ts';
import { Field, Modal } from '../ui/modal.tsx';
import type { PackageFilter } from './filter.ts';
import type { Evaluation } from './ledger.ts';
import { money, text } from './ledger.ts';

export function Detail({
  result,
  onClose,
}: {
  result: Evaluation;
  onClose: () => void;
}) {
  const p = result.pkg;
  return (
    <Modal title={`${p.id} · ${p.hotel || p.name}`} onClose={onClose} wide>
      <p>{p.name}</p>
      <div className="detail-stats">
        <div>
          <small>订单实付</small>
          <strong>{yuan(p.paid)}</strong>
        </div>
        <div>
          <small>已付额外补款</small>
          <strong>{yuan(p.paidExtra)}</strong>
        </div>
        <div>
          <small>本次入住</small>
          <strong>{result.nights} 晚</strong>
        </div>
      </div>
      <p>
        <b>有效期原文：</b>
        {p.validity || '未提供'}
      </p>
      <p>
        <b>雪场原文：</b>
        {p.resort || '未提供'}
      </p>
      <p>
        <b>房型：</b>
        {p.room || '待确认'}
      </p>
      <h3>逐晚补款依据</h3>
      <p className="muted">
        {result.start} 入住，{result.end} 离店。离店当天不计住宿加价。
        {result.needsHotel
          ? '以下加价仅为原表指定酒店示例，最终适用门店尚需确认。'
          : ''}
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>住宿日期</th>
              <th>已识别加价</th>
              <th>来源 / 缺失原因</th>
            </tr>
          </thead>
          <tbody>
            {result.nightly.map((n) => (
              <tr key={n.day}>
                <td>{n.day}</td>
                <td>{yuan(n.amount)}</td>
                <td>{n.source || n.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {result.reasons.map((s) => (
        <p className="error" key={s}>
          {s}
        </p>
      ))}
      <h3>原始详情与加价表</h3>
      <p className="muted small">
        来源：{p.source}。仅按编号关联；原表的冲突、缺失和适用条件均保留。
      </p>
      {p.details.length ? (
        p.details.map((s) => (
          <details key={s.name}>
            <summary>{s.name}</summary>
            <div className="table-scroll">
              <table>
                <tbody>
                  {s.rows.map((r) => (
                    <tr key={r.number}>
                      <th className="row-number">{r.number}</th>
                      {r.cells.map((c, i) => (
                        <td key={i}>{text(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))
      ) : (
        <p>未找到按编号命名的详情表，当前仅有套餐主表记录。</p>
      )}
    </Modal>
  );
}

export function Comparison({
  results,
  filter,
  onClose,
}: {
  results: Evaluation[];
  filter: PackageFilter;
  onClose: () => void;
}) {
  const [costs, setCosts] = useState<Record<string, Record<string, string>>>(
    {},
  );
  const numbers = (r: Evaluation) => {
    const c = costs[r.pkg.id] || {};
    return {
      supplement: money(c.supplement),
      transport: money(c.transport),
      other: money(c.other),
    };
  };
  return (
    <Modal title="对比出行方案" onClose={onClose} wide>
      <p className="muted">
        {filter.start} 出发 · 输入本次仍需支付的费用（整单 /
        元）。原有已付款不重复计入新增支出。空白表示未知，填 0
        才表示无需额外支出。
      </p>
      <div
        className="comparison-grid"
        style={{ '--count': results.length } as React.CSSProperties}
      >
        {results.map((r) => {
          const p = r.pkg,
            c = costs[p.id] || {},
            n = numbers(r),
            complete = Object.values(n).every((v) => v !== null);
          return (
            <section className="compare-card" key={p.id}>
              <span className="eyebrow">
                套餐 {p.id} / {p.region}
              </span>
              <h3>{p.hotel}</h3>
              <p>
                {r.start} → {r.end} · {r.nights} 晚
              </p>
              <p className="muted">
                原订单已付{' '}
                {yuan(p.paidExtra === null ? null : p.paid + p.paidExtra)}
                {p.split ? '（含本次之外间夜）' : ''}
              </p>
              <div className="notice small">
                台账补款{r.complete ? '合计' : '已知部分'} {yuan(r.known)}
                {r.needsHotel ? ' · 指定酒店示例' : ''}；需核对适用条件。
              </div>
              {[
                ['supplement', '本次房间补款'],
                ['transport', '往返交通'],
                ['other', '餐饮 / 雪票 / 其他'],
              ].map(([key, label]) => (
                <Field key={key} label={label + '（手动估算）'}>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="待确认"
                    value={c[key] ?? ''}
                    onChange={(e) =>
                      setCosts({
                        ...costs,
                        [p.id]: { ...c, [key]: e.target.value },
                      })
                    }
                  />
                </Field>
              ))}
              <div className="compare-total">
                <span>预计新增支出</span>
                <strong>
                  {complete
                    ? yuan(
                        (n.supplement ?? 0) +
                          (n.transport ?? 0) +
                          (n.other ?? 0),
                      )
                    : '费用未完整'}
                </strong>
              </div>
              {r.reasons.map((x) => (
                <p className="error small" key={x}>
                  {x}
                </p>
              ))}
              <p className="muted small">
                机酒实时库存未接入；手动金额不代表商家报价。
              </p>
            </section>
          );
        })}
      </div>
      <div className="modal-actions">
        <button onClick={onClose}>返回调整</button>
      </div>
    </Modal>
  );
}
