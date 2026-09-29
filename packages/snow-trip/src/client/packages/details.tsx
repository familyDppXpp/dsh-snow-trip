import { extraPaymentDescription, fieldLabels } from '../../shared/packages.ts';
import type { PackageRecord } from '../integration/types.ts';
import { yuan } from '../ui/format.ts';
import { PackageBenefits } from './card.tsx';
import { cumulativePaid } from './filter.ts';
export function PackageFacts({
  record,
  fields,
}: {
  record: PackageRecord;
  fields: (keyof typeof fieldLabels)[];
}) {
  return (
    <dl className="snow-detail-facts">
      {fields.map((key) => {
        const value = record[key];
        const shown =
          key === 'extraPayments'
            ? record.extraPayments?.map(extraPaymentDescription).join('；') ||
              (record.paidExtra === 0 ? '无' : '待确认')
            : value === null
              ? '待确认'
              : Array.isArray(value)
                ? value.length
                  ? value.join('；')
                  : '已确认无'
                : ['quote', 'paid', 'paidExtra'].includes(key)
                  ? yuan(Number(value) / 100)
                  : typeof value === 'boolean'
                    ? value
                      ? '是'
                      : '否'
                    : String(value);
        return (
          <div key={key}>
            <dt>{fieldLabels[key]}</dt>
            <dd className={value === null ? 'is-unknown' : undefined}>
              {shown}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
export function PackageDetails({
  record,
  expanded,
}: {
  record: PackageRecord;
  expanded: boolean;
}) {
  const DetailSection = expanded ? 'section' : 'details',
    DetailHeading = expanded ? 'h3' : 'summary';
  return (
    <div className="snow-package-detail">
      <div className="snow-detail-highlights">
        <div>
          <span>累计已支付</span>
          <strong>
            {cumulativePaid(record) === null
              ? '待补全'
              : yuan((cumulativePaid(record) ?? 0) / 100)}
          </strong>
        </div>
        <div>
          <span>住宿间夜</span>
          <strong>
            {record.nights ?? '待确认'}
            {record.nights !== null && <small> 间夜</small>}
          </strong>
        </div>
      </div>
      <section>
        <h3>住宿信息</h3>
        <PackageFacts
          record={record}
          fields={['hotels', 'roomType', 'resort', 'region', 'description']}
        />
      </section>
      <PackageBenefits record={record} />
      <section>
        <h3>购买与使用</h3>
        <PackageFacts
          record={record}
          fields={[
            'purchasePlatform',
            'quote',
            'paid',
            'paidExtra',
            'extraPayments',
            'validFrom',
            'validTo',
            'usedNights',
            'voided',
          ]}
        />
      </section>
      <DetailSection className="snow-detail-section">
        <DetailHeading>使用规则</DetailHeading>
        <PackageFacts
          record={record}
          fields={['surchargeRules', 'unavailableDates']}
        />
      </DetailSection>
      {record.unknowns.length > 0 && (
        <DetailSection className="snow-detail-section snow-detail-pending">
          <DetailHeading>
            待补全 <span>{record.unknowns.length} 项</span>
          </DetailHeading>
          <ul>
            {record.unknowns.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </DetailSection>
      )}
    </div>
  );
}
