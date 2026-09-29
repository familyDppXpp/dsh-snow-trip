import { z } from 'zod';
import { evaluateMetadata } from '../../shared/plans.ts';
import type { PlanMetadata, ToolBlock } from '../conversation/card-types.ts';
import { PlanFallback } from '../conversation/tool-fallback.tsx';
export function EvaluateCard({ block }: { block?: ToolBlock }) {
  const computed = block?.meta as PlanMetadata | undefined;
  if (computed?.status === 'computed' && computed.resultId)
    return (
      <article className="snow snow-plan-card" role="status">
        <h3>候选核算通过</h3>
        <p>已通过 {computed.passed} 份；完成比较后统一展示。</p>
      </article>
    );
  const meta =
    block && 'kind' in block && !block.isError
      ? evaluateMetadata(block.meta)
      : null;
  if (!meta) return <PlanFallback block={block} label="方案核算" />;
  const yuan = (n: number | null | undefined) =>
    n == null
      ? '待确认'
      : `${(n / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} 元`;
  const rows = legacyResults.safeParse(meta.results).data?.combos ?? [];
  return (
    <article
      className="snow trip-card snow-plan-card"
      aria-label="方案核算结果"
    >
      {rows.length
        ? rows.map((combo, index) => (
            <section key={index} className="snow-plan-combo">
              <h3>{combo.basis || '候选搭配'}</h3>
              {combo.total != null && (
                <p className="snow-plan-total">
                  整趟总价 <strong>{yuan(combo.total)}</strong>
                </p>
              )}
              {Array.isArray(combo.daily) && combo.daily.length > 0 && (
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
                      {combo.daily.map((row, i) => (
                        <tr key={i}>
                          <td>{row.date}</td>
                          <td>{yuan(row.amount)}</td>
                          <td>{row.basis ?? ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {Array.isArray(combo.checks) && combo.checks.length > 0 && (
                <ul className="snow-plan-checks">
                  {combo.checks.map((check, i) => (
                    <li key={i}>{check}</li>
                  ))}
                </ul>
              )}
            </section>
          ))
        : null}
      {!rows.length &&
        meta.combos.map((combo, index) => (
          <section key={combo.packageId + index} className="snow-plan-combo">
            <h3>{combo.snapshot.name}</h3>
            <p>
              {combo.start} 入住 · {combo.nights} 晚 ·{' '}
              {combo.snapshot.hotels?.join('、') ?? '酒店待确认'}
            </p>
            <p className="muted">
              版本第 {combo.revision} 版；逐日费用见下方说明。
            </p>
          </section>
        ))}
    </article>
  );
}

export function PlanningToolCard({ block }: { block?: ToolBlock }) {
  const data = block?.meta as PlanMetadata | undefined;
  if (data?.status === 'save_results')
    return (
      <article className="snow snow-plan-card">
        <h3>保存结果</h3>
        {data.items?.map((r, i) => (
          <p key={i}>
            {r.title ?? '方案'}：
            {r.status === 'saved'
              ? '已保存，可在已存方案查看'
              : `未保存 · ${r.error}`}
          </p>
        ))}
      </article>
    );
  if (data?.status === 'prepared')
    return <p role="status">条件已确认，正在准备候选搭配。</p>;
  if (data?.planningId && Array.isArray(data.results))
    return (
      <p role="status">
        已通过 {data.passed} 份候选 ·{' '}
        {data.comparisonComplete
          ? '比较已完成'
          : '尚未完成全部比较，已通过结果保留'}
      </p>
    );
  if (block?.isError) return <PlanFallback block={block} label="出行规划" />;
  return null;
}

export const legacyResults = z.object({
  combos: z.array(
    z.object({
      basis: z.string().optional(),
      total: z.number().nullable().optional(),
      daily: z
        .array(
          z.object({
            date: z.string(),
            amount: z.number().nullable(),
            basis: z.string().nullable().optional(),
          }),
        )
        .optional(),
      checks: z.array(z.string()).optional(),
    }),
  ),
});
