import { useId, useState } from 'react';
import { Badge, BodyProps, readableBasis, yuan } from './question-shared.tsx';
export function PlanOptionsBody({
  data,
  busy,
  onAnswer,
  cancel,
  readOnly = false,
}: BodyProps) {
  const [selected, setSelected] = useState(() => data.selected ?? []);
  const [active, setActive] = useState(0);
  const tabsId = useId();
  const respond = (action: string) =>
    onAnswer?.({
      selected: [action],
      custom: JSON.stringify({ stage: data.stage, selected }),
    });
  if (data.stage === 'results')
    return (
      <>
        {data.comparisonComplete === false && (
          <p className="snow-plan-note">
            尚未完成全部比较；以下方案已通过核算，可查看或保存。
          </p>
        )}
        <div className="snow-result-tabs" role="tablist" aria-label="候选方案">
          {(data.results ?? []).map((combo, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              id={`${tabsId}-tab-${index}`}
              aria-controls={`${tabsId}-panel-${index}`}
              aria-selected={active === index}
              tabIndex={active === index ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => {
                const count = data.results?.length ?? 0;
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % count
                    : event.key === 'ArrowLeft'
                      ? (index + count - 1) % count
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? count - 1
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setActive(next);
                  (
                    event.currentTarget.parentElement?.children[next] as
                      | HTMLElement
                      | undefined
                  )?.focus();
                }
              }}
            >
              {combo.title || `方案 ${index + 1}`}
              {selected.includes(index) && <span aria-label="已选择"> ✓</span>}
            </button>
          ))}
        </div>
        <div className="snow-result-panels">
          {(data.results ?? []).map((combo, index) => (
            <article
              key={index}
              role="tabpanel"
              id={`${tabsId}-panel-${index}`}
              aria-labelledby={`${tabsId}-tab-${index}`}
              hidden={active !== index}
              tabIndex={0}
              className={`snow snow-plan-result${selected.includes(index) ? ' is-selected' : ''}`}
            >
              {readOnly && (
                <span className="snow-result-select">
                  {selected.includes(index) ? '✓ 已选择' : '未选择'}
                </span>
              )}
              {!readOnly && (
                <label className="snow-result-select">
                  <input
                    type={data.updating ? 'radio' : 'checkbox'}
                    name={data.updating ? tabsId : undefined}
                    aria-label={`选择方案 ${index + 1}`}
                    checked={selected.includes(index)}
                    disabled={busy}
                    onChange={() =>
                      setSelected(
                        data.updating
                          ? [index]
                          : selected.includes(index)
                            ? selected.filter((i) => i !== index)
                            : [...selected, index],
                      )
                    }
                  />
                  <span>
                    {selected.includes(index) ? '已选择' : '选择此方案'}
                  </span>
                </label>
              )}
              <div className="snow-plan-result-head">
                <div>
                  <Badge>
                    {index === 0 ? '优先推荐' : `备选 ${index + 1}`}
                  </Badge>
                  <h3>{combo.title || '候选搭配'}</h3>
                  <small>
                    {combo.start ?? ''}
                    {combo.end ? ` → ${combo.end}` : ''}
                    {combo.nights != null ? ` · ${combo.nights} 晚` : ''}
                  </small>
                </div>
                <div className="snow-plan-money">
                  <strong>{yuan(combo.total)}</strong>
                  <small>
                    整趟总成本{combo.estimated ? ' · 含已确认估算' : ''}
                  </small>
                </div>
              </div>
              {combo.reason && (
                <p className="snow-plan-reason">
                  {readableBasis(combo.reason)}
                </p>
              )}
              {!!combo.daily?.length && (
                <div className="table-scroll snow-result-daily">
                  <table aria-label={`候选 ${index + 1} 每日费用`}>
                    <thead>
                      <tr>
                        <th scope="col">日期 / 住宿</th>
                        <th scope="col">当晚费用</th>
                        <th scope="col">计算依据</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combo.daily.map((row, i) => (
                        <tr key={i}>
                          <td>
                            {row.date}
                            {row.hotel && (
                              <>
                                <br />
                                {row.hotel}
                              </>
                            )}
                          </td>
                          <td>{yuan(row.amount)}</td>
                          <td>{readableBasis(row.basis)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {combo.sharedCosts?.map((cost, i) => (
                <p key={i} className="snow-plan-shared">
                  <b>
                    {cost.label} {yuan(cost.amount)}
                  </b>{' '}
                  <span className="snow-plan-muted">整趟计一次</span>
                  {cost.basis && (
                    <span className="snow-shared-basis">
                      {combo.resultId
                        ? readableBasis(cost.basis).replace(/待确认/g, '已确认')
                        : readableBasis(cost.basis)}
                    </span>
                  )}
                </p>
              ))}
              {combo.allocation?.map((line, i) => (
                <p key={i} className="snow-plan-muted snow-result-allocation">
                  {readableBasis(line)}
                </p>
              ))}
              {combo.resultId && (
                <p className="snow-result-verified">行程与费用已核对</p>
              )}
              <p className="snow-plan-pills">
                <span className="snow-plan-pill">
                  {combo.budget == null
                    ? '未设预算'
                    : combo.total == null
                      ? '预算待核对'
                      : combo.total > combo.budget
                        ? '超出预算'
                        : `预算内 · 余 ${yuan(combo.budget - combo.total)}`}
                </span>
              </p>
            </article>
          ))}
        </div>
        {!readOnly && (
          <footer className="snow-plan-bar">
            <span aria-live="polite">
              {selected.length
                ? `已选择 ${selected.length} 份`
                : data.updating
                  ? '选择一份方案后核对差异'
                  : '勾选方案后可保存'}
            </span>
            {cancel}
            <button
              className="primary"
              disabled={!selected.length || busy}
              onClick={() => respond('保存所选')}
            >
              {busy
                ? '正在处理…'
                : data.updating
                  ? '核对更新差异'
                  : `保存所选${selected.length ? `（${selected.length}）` : ''}`}
            </button>
          </footer>
        )}
      </>
    );
  if (data.stage === 'discussion') {
    const chosen = (data.results ?? []).filter((_, i) =>
      (data.selected ?? []).includes(i),
    );
    return (
      <>
        {data.message && <p>你的想法：{data.message}</p>}
        {chosen.length > 1 && (
          <div className="table-scroll">
            <table aria-label="方案比较">
              <thead>
                <tr>
                  <th>搭配</th>
                  <th>整趟总价</th>
                  <th>换酒店</th>
                  <th>推荐理由</th>
                </tr>
              </thead>
              <tbody>
                {chosen.map((c, i) => (
                  <tr key={i}>
                    <td>候选 {(data.selected ?? [])[i] + 1}</td>
                    <td>{yuan(c.total)}</td>
                    <td>{c.switches ?? '—'}</td>
                    <td>{c.reason ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {chosen.length === 1 && (
          <p className="snow-plan-muted">
            基于候选 {(data.selected ?? [])[0] + 1}{' '}
            讨论；重新计算与保存会检查套餐版本。
          </p>
        )}
        {!chosen.length && (
          <p className="snow-plan-muted">
            不用先选方案。可以直接调整偏好，再确认条件生成新的搭配。
          </p>
        )}
        {!readOnly && (
          <footer className="snow-plan-actions">
            {cancel}
            <button
              disabled={busy}
              onClick={() => onAnswer?.({ selected: ['调整预算或日期'] })}
            >
              调整预算或日期
            </button>
          </footer>
        )}
      </>
    );
  }
  if (data.stage === 'review') {
    const plan = data.plan;
    return (
      <>
        {plan && (
          <>
            {plan.costVersion !== 2 && (
              <p className="snow-plan-note">
                旧补款核算口径 · 保留当时金额，重新出行前请重新核算。
              </p>
            )}
            <p>
              {plan.start ?? ''}
              {plan.nights != null ? ` · ${plan.nights} 晚` : ''} ·{' '}
              {plan.packages?.length ?? 0} 份套餐搭配
            </p>
            {!!plan.daily?.length && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>费用</th>
                      <th>依据</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.daily.map((row, i) => (
                      <tr key={i}>
                        <td>{row.date}</td>
                        <td>{yuan(row.amount)}</td>
                        <td>{readableBasis(row.basis)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="snow-plan-pills">
              <span className="snow-plan-pill">
                整趟总价 {yuan(plan.total)}
              </span>
            </p>
            {plan.reason && <p className="snow-plan-reason">{plan.reason}</p>}
            {!!plan.unknowns?.length && (
              <p className="snow-plan-muted">
                未知项：{plan.unknowns.join('、')}
              </p>
            )}
          </>
        )}
        <p className="snow-plan-muted">
          回顾不自动读取新价格；继续调整后，计算与保存都会检查最新套餐。
        </p>
        {!readOnly && (
          <footer className="snow-plan-actions">
            {cancel}
            <button
              className="primary"
              disabled={busy}
              onClick={() => onAnswer?.({ selected: ['继续调整'] })}
            >
              继续调整这份方案
            </button>
          </footer>
        )}
      </>
    );
  }
  return (
    <>
      <p className="snow-plan-muted">{data.questionText}</p>
      <footer className="snow-plan-actions">{cancel}</footer>
    </>
  );
}
