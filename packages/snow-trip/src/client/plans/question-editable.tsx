import { useState } from 'react';
import { errorMessage } from '../../shared/errors.ts';
import { purchaseLabels } from '../../shared/packages.ts';
import type { PlanQuestionData } from '../../shared/plan-question.ts';
import { toCents } from '../../shared/plans.ts';
import { Badge, BodyProps } from './question-shared.tsx';
export function PlanEditableBody({
  data,
  packages,
  busy,
  error,
  onAnswer,
  cancel,
}: BodyProps & { packages?: PlanQuestionData['packages'] }) {
  const [values, setValues] = useState(() => ({
    start: String(data.input?.start ?? data.start ?? ''),
    nights: String(data.input?.nights ?? data.nights ?? ''),
    budget: String(data.input?.budget ?? ''),
    ...(data.planning
      ? {
          rooms: String(data.input?.rooms ?? ''),
          ...(data.input?.people !== undefined
            ? { people: String(data.input.people) }
            : {}),
          ...(data.input?.skiDays !== undefined
            ? { skiDays: String(data.input.skiDays) }
            : {}),
        }
      : {}),
  }));
  const [fees, setFees] = useState(() =>
    (data.fees ?? []).map((f) => ({
      ...f,
      unitPrice: String(f.unitPrice / 100),
      quantity: String(f.quantity),
    })),
  );
  const [inputError, setInputError] = useState('');
  const [ids, setIds] = useState(() => [...(data.ids ?? [])]);
  const [estimates, setEstimates] = useState(() =>
    (data.estimates ?? []).map((e) => ({
      ...e,
      amount: e.amount != null ? String(e.amount / 100) : '',
    })),
  );
  const suggested = Array.isArray(data.suggestions)
    ? undefined
    : data.suggestions;
  const usable = (packages ?? []).filter((p) => p.completeness === 'complete');
  const selectedPackages = usable.filter((p) => ids.includes(p.id));
  const rest = usable.filter((p) => !ids.includes(p.id));
  const submit = () => {
    try {
      if (data.planning) {
        if (
          !values.start ||
          !Number.isInteger(Number(values.nights)) ||
          Number(values.nights) < 1 ||
          Number(values.nights) > 366
        )
          throw new Error('请确认具体入住日期和住宿晚数');
        if (!Number.isInteger(Number(values.rooms)) || Number(values.rooms) < 1)
          throw new Error('请确认房间数');
      }
      const amounts = estimates.map((e) => {
        const amount = e.amount.trim();
        if (amount && !/^\d+(\.\d{1,2})?$/.test(amount))
          throw new Error('费用请填写非负金额，最多两位小数');
        return { ...e, amount: amount ? toCents(Number(amount)) : null };
      });
      setInputError('');
      onAnswer?.({
        selected: data.planning ? ['生成方案'] : [],
        custom: JSON.stringify({
          stage: data.stage,
          values,
          ids,
          estimates: amounts,
          ...(data.planning
            ? {
                fees: fees.map((f) => {
                  if (
                    !f.unitPrice.trim() ||
                    !f.quantity.trim() ||
                    Number(f.quantity) < 0
                  )
                    throw new Error('请填写费用单价和数量');
                  return {
                    ...f,
                    quantity: Number(f.quantity),
                    unitPrice: toCents(Number(f.unitPrice)),
                  };
                }),
              }
            : {}),
          amountUnit: '分',
        }),
      });
    } catch (e) {
      setInputError(errorMessage(e));
    }
  };
  return (
    <>
      {data.stage === 'confirm' && (
        <>
          <div className="snow-plan-fields">
            <label>
              入住日期
              <input
                type="date"
                disabled={busy}
                value={values.start}
                onChange={(e) =>
                  setValues({ ...values, start: e.target.value })
                }
              />
            </label>
            <label>
              住宿晚数
              <input
                type="number"
                disabled={busy}
                min="1"
                max="366"
                placeholder={
                  suggested?.nights ? `建议 ${suggested.nights} 晚` : '不限'
                }
                value={values.nights}
                onChange={(e) =>
                  setValues({ ...values, nights: e.target.value })
                }
              />
            </label>
            <label>
              整趟总预算 / 元
              <input
                type="number"
                disabled={busy}
                min="0"
                step="0.01"
                placeholder="不限"
                value={values.budget}
                onChange={(e) =>
                  setValues({ ...values, budget: e.target.value })
                }
              />
            </label>
            {data.planning && (
              <label>
                房间数
                <input
                  type="number"
                  min="1"
                  max="100"
                  disabled={busy}
                  value={values.rooms}
                  onChange={(e) =>
                    setValues({ ...values, rooms: e.target.value })
                  }
                />
              </label>
            )}
            {data.planning && values.people !== undefined && (
              <label>
                出行人数
                <input
                  type="number"
                  min="1"
                  disabled={busy}
                  value={values.people}
                  onChange={(e) =>
                    setValues({ ...values, people: e.target.value })
                  }
                />
              </label>
            )}
            {data.planning && values.skiDays !== undefined && (
              <label>
                滑雪天数
                <input
                  type="number"
                  min="0"
                  disabled={busy}
                  value={values.skiDays}
                  onChange={(e) =>
                    setValues({ ...values, skiDays: e.target.value })
                  }
                />
              </label>
            )}
          </div>
          {(suggested?.start || suggested?.nights) && (
            <p className="snow-plan-note">
              {suggested.start && (
                <Badge tone="suggest">建议日期 {suggested.start}</Badge>
              )}
              {suggested.nights && (
                <Badge tone="suggest">建议 {suggested.nights} 晚</Badge>
              )}
            </p>
          )}
          {Array.isArray(data.suggestions) && (
            <ul className="snow-plan-note">
              {data.suggestions.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          )}
          <section aria-label="参与搭配的套餐">
            <h4>参与搭配的套餐</h4>
            <p className="snow-plan-muted">
              可指定套餐范围；全不选则从全部资料完整的套餐中筛选。
            </p>
            {selectedPackages.map((p) => (
              <PlanPackageRow
                key={p.id}
                record={p}
                checked={ids.includes(p.id)}
                onToggle={() =>
                  setIds(
                    ids.includes(p.id)
                      ? ids.filter((x) => x !== p.id)
                      : [...ids, p.id],
                  )
                }
                recommended={(data.ids ?? []).includes(p.id)}
              />
            ))}
            {rest.length > 0 && (
              <details className="snow-plan-more">
                <summary>更多套餐（{rest.length}）</summary>
                {rest.map((p) => (
                  <PlanPackageRow
                    key={p.id}
                    record={p}
                    checked={ids.includes(p.id)}
                    onToggle={() =>
                      setIds(
                        ids.includes(p.id)
                          ? ids.filter((x) => x !== p.id)
                          : [...ids, p.id],
                      )
                    }
                  />
                ))}
              </details>
            )}
            {!data.planning && (
              <details className="snow-plan-estimates">
                <summary>补充已知的交通与餐饮费用（可留空）</summary>
                {['交通', '餐饮'].map((label) => {
                  const known = estimates.find((e) => e.label === label);
                  return (
                    <label key={label} className="snow-plan-estimate-field">
                      {label} / 元
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={known?.amount ?? ''}
                        onChange={(e) =>
                          setEstimates(
                            estimates.find((x) => x.label === label)
                              ? estimates.map((x) =>
                                  x.label === label
                                    ? { ...x, amount: e.target.value }
                                    : x,
                                )
                              : [
                                  ...estimates,
                                  {
                                    label,
                                    amount: e.target.value,
                                    basis: '用户提供',
                                  },
                                ],
                          )
                        }
                      />
                    </label>
                  );
                })}
              </details>
            )}
          </section>
        </>
      )}
      {data.planning && (
        <section aria-label="共同费用">
          <h4>共同费用</h4>
          <p className="snow-plan-muted">
            核对需求数量与单价；套餐已包含的权益将在核算时按实际覆盖数量抵扣。
          </p>
          {fees.map((f, i) => (
            <div className="snow-estimate-row snow-fee-row" key={f.id}>
              <div className="snow-estimate-copy">
                <strong>{f.label}</strong>
                <span className="snow-estimate-basis">
                  {f.source === 'estimate' ? '待确认估算' : '用户提供'} ·{' '}
                  {f.basis}
                </span>
              </div>
              <label>
                数量
                <input
                  type="number"
                  min="0"
                  step="any"
                  disabled={busy}
                  value={f.quantity}
                  onChange={(e) =>
                    setFees(
                      fees.map((x, j) =>
                        j === i ? { ...x, quantity: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
              <label>
                单价 / 元
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={busy}
                  value={f.unitPrice}
                  onChange={(e) =>
                    setFees(
                      fees.map((x, j) =>
                        j === i ? { ...x, unitPrice: e.target.value } : x,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </section>
      )}
      {data.stage === 'estimate' && (
        <div className="snow-estimate-body">
          <p className="snow-estimate-trip">
            <span>
              {data.start ?? '日期待定'} 入住
              {data.suggested?.start && <Badge tone="suggest">建议日期</Badge>}
            </span>
            <span>
              {data.nights ?? '?'} 晚
              {data.suggested?.nights && <Badge tone="suggest">建议晚数</Badge>}
            </span>
            <span>金额 / 元</span>
          </p>
          <div className="snow-estimate-list">
            {(data.estimates ?? []).map((e, i) => (
              <label key={i} className="snow-estimate-row">
                <span className="snow-estimate-copy">
                  <span className="snow-estimate-name">
                    {e.label}
                    <small>
                      {e.basis === '用户提供' ? '已提供' : '待确认估算'}
                    </small>
                  </span>
                  {e.basis && (
                    <span className="snow-estimate-basis">{e.basis}</span>
                  )}
                </span>
                <span className="snow-estimate-amount">
                  <span aria-hidden="true">¥</span>
                  <input
                    aria-label={`${e.label} / 元`}
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    disabled={busy}
                    placeholder="待确认"
                    value={estimates[i]?.amount ?? ''}
                    onChange={(ev) =>
                      setEstimates(
                        estimates.map((x, j) =>
                          j === i ? { ...x, amount: ev.target.value } : x,
                        ),
                      )
                    }
                  />
                </span>
              </label>
            ))}
          </div>
          {data.scope && (
            <div className="snow-estimate-scope">
              <strong>费用范围</strong>
              <p>{data.scope}</p>
            </div>
          )}
        </div>
      )}
      {(inputError || error) && (
        <p className="snow-plan-error" role="alert">
          {inputError || error}
        </p>
      )}
      <footer className="snow-plan-actions snow-plan-submit">
        {data.stage === 'estimate' && <span>估算可修改，确认后才用于核算</span>}
        {cancel}
        <button className="primary" disabled={busy} onClick={submit}>
          {busy
            ? '正在处理…'
            : data.stage === 'confirm'
              ? '生成方案'
              : '接受这些条件并计算'}
        </button>
      </footer>
    </>
  );
}

export function PlanPackageRow({
  record: p,
  checked,
  onToggle,
  recommended,
}: {
  record: NonNullable<PlanQuestionData['packages']>[number];
  checked: boolean;
  onToggle: () => void;
  recommended?: boolean;
}) {
  return (
    <label className={`snow-plan-package${checked ? ' is-checked' : ''}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      <span>
        {p.name} {recommended && <Badge>推荐</Badge>}
        <small>
          {purchaseLabels[p.purchaseStatus as keyof typeof purchaseLabels]} ·{' '}
          {p.nights ?? '晚数待确认'} 晚 ·{' '}
          {p.splitAllowed === true
            ? '可拆分'
            : p.splitAllowed === false
              ? '需连住'
              : '拆分待确认'}{' '}
          · 资料完整
        </small>
      </span>
    </label>
  );
}
