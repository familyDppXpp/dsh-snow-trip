import {
  benefitSummary,
  packageMetadata,
  purchaseLabels,
} from '../../shared/packages.ts';
import type { ToolBlock } from '../conversation/card-types.ts';
import type { PackageRecord } from '../integration/types.ts';
import { cumulativePaid } from './filter.ts';
export function PackageCard({
  record: p,
  onOpen,
  onDelete,
  onInspect,
  saved = false,
}: {
  record: PackageRecord;
  onOpen?: (p: PackageRecord) => void;
  onDelete?: (p: PackageRecord) => void;
  onInspect?: (p: PackageRecord) => void;
  saved?: boolean;
}) {
  return (
    <article
      className="snow trip-card snow-package-card"
      data-package-id={p.id}
      data-revision={p.revision}
      onClick={(event) => {
        if (!(event.target as Element).closest('button')) onInspect?.(p);
      }}
    >
      <div className="card-body">
        <div className="card-meta">
          <span className="package-status">
            {saved ? '已保存 · ' : ''}
            {purchaseLabels[p.purchaseStatus]}
          </span>
          <span>{p.completeness === 'incomplete' ? '待补全' : '资料完整'}</span>
        </div>
        <header className="package-heading">
          <h3>
            {onInspect ? (
              <button
                className="package-inspect"
                onClick={() => onInspect(p)}
                aria-label={`查看套餐详情：${p.name}`}
              >
                {p.name}
              </button>
            ) : (
              p.name
            )}
          </h3>
          <p>
            {p.hotels === null
              ? '适用酒店待确认'
              : p.hotels.join('、') || '已确认无适用酒店'}
          </p>
        </header>
        <div className="package-stay-overview">
          <div>
            <span>住宿间夜</span>
            <strong>
              {p.nights ?? '待确认'}
              {p.nights !== null && <small> 间夜</small>}
            </strong>
          </div>
          <div>
            <span>已使用</span>
            <strong>
              {p.usedNights ?? '待确认'}
              {p.usedNights !== null && <small> 间夜</small>}
            </strong>
          </div>
        </div>
        <div className="package-validity">
          <span>有效期</span>
          <p>
            {p.validFrom ?? '待确认'} 至 {p.validTo ?? '待确认'}
          </p>
        </div>
        <div className="package-cost-overview">
          <div className="package-paid">
            <span>累计已支付</span>
            <strong>
              {cumulativePaid(p) === null ? '待补全' : money(cumulativePaid(p))}
            </strong>
          </div>
          <dl>
            <div>
              <dt>套餐本价实付</dt>
              <dd>{money(p.paid)}</dd>
            </div>
            <div>
              <dt>套餐报价</dt>
              <dd>{money(p.quote)}</dd>
            </div>
            <div>
              <dt>已付额外补款</dt>
              <dd>{money(p.paidExtra)}</dd>
            </div>
          </dl>
        </div>
        {p.unknowns.length > 0 && (
          <p className="package-missing">
            <span>待补全</span>
            {p.unknowns.join('、')}
          </p>
        )}
        {saved && <small>保存时快照</small>}
        {(onOpen || onDelete) && (
          <div className="package-actions">
            {onOpen && (
              <button
                className="primary package-open"
                onClick={() => onOpen(p)}
              >
                {p.completeness === 'incomplete' ? '继续补全' : '补充信息'}{' '}
                <span aria-hidden="true">→</span>
              </button>
            )}
            {onDelete && (
              <button className="package-delete" onClick={() => onDelete(p)}>
                删除套餐
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export function PackageBenefits({
  record,
}: {
  record: Parameters<typeof benefitSummary>[0];
}) {
  return (
    <section className="package-benefits" aria-label="包含权益">
      <h4>包含权益</h4>
      <dl>
        {benefitSummary(record).map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.text}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function savedPackage(block: ToolBlock | undefined) {
  return block && 'kind' in block && !block.isError && !block.parentCallId
    ? packageMetadata(block.meta)
    : null;
}

export function SavedPackageCard({ block }: { block?: ToolBlock }) {
  const record = savedPackage(block);
  if (record)
    return (
      <p>
        已保存套餐：{record.name} · 第 {record.revision} 版
      </p>
    );
  const content = Array.isArray(block?.content)
    ? block.content
        .filter((c) => c?.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text)
        .join('\n')
    : '';
  return (
    <details>
      <summary>
        套餐保存 ·{' '}
        {block?.isError
          ? '保存失败'
          : block && 'kind' in block
            ? '工具结果'
            : '等待确认或保存'}
      </summary>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {content || '暂无结果'}
      </pre>
    </details>
  );
}

export const money = (n: number | null | undefined) =>
  n == null ? '待确认' : `${(n / 100).toFixed(2)} 元`;
