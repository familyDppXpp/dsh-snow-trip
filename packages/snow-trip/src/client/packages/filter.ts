import type { PackageRecord } from '../../shared/packages.ts';
import type { PlanRecord } from '../../shared/plans.ts';
export interface PackageFilter {
  start: string;
  nights: string;
  region: string;
  query: string;
  purchaseStatuses: string[];
  completeness: string[];
  hasPlan: string;
}
export const cumulativePaid = (p: Pick<PackageRecord, 'paid' | 'paidExtra'>) =>
  p.paid == null || p.paidExtra == null ? null : p.paid + p.paidExtra;
// 宿主金额单位为分；文字规则保留原文，不推算逐晚补款。
export function packageStats(rows: PackageRecord[]) {
  const known = (key: keyof PackageRecord) =>
    rows.filter((p) => p[key] !== null);
  return {
    count: rows.length,
    nights: known('nights').reduce((sum, p) => sum + (p.nights ?? 0), 0),
    nightsUnknown: rows.length - known('nights').length,
    paid: rows.reduce((sum, p) => sum + (p.paid ?? 0) + (p.paidExtra ?? 0), 0),
    paidUnknown: rows.filter((p) => p.paid === null || p.paidExtra === null)
      .length,
    regions: [
      ...new Set(
        rows
          .map((p) => p.region)
          .filter((region): region is string => region !== null),
      ),
    ],
    regionsUnknown: rows.filter((p) => p.region === null).length,
  };
}
export function packageCandidates(
  rows: PackageRecord[],
  filter: PackageFilter,
  sort: string,
  plans: PlanRecord[] = [],
  direction = 'desc',
) {
  const plannedIds = new Set(
    plans.flatMap((plan) => plan.items.map((item) => item.packageId)),
  );
  const matches = rows.filter((p) => {
    if (filter.hasPlan && plannedIds.has(p.id) !== (filter.hasPlan === 'yes'))
      return false;
    if (filter.region !== '全部目的地' && p.region !== filter.region)
      return false;
    if (
      ![p.name, p.description, p.resort, ...(p.hotels ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(filter.query.toLowerCase())
    )
      return false;
    if (
      filter.purchaseStatuses?.length &&
      !filter.purchaseStatuses.includes(p.purchaseStatus)
    )
      return false;
    if (
      filter.completeness?.length &&
      !filter.completeness.includes(p.completeness)
    )
      return false;
    if (filter.start || filter.nights) {
      const nights = filter.nights ? Number(filter.nights) : p.nights;
      if (
        nights == null ||
        !Number.isInteger(nights) ||
        nights < 1 ||
        p.nights == null ||
        p.usedNights == null ||
        nights > p.nights - p.usedNights
      )
        return false;
      if (filter.start) {
        const lastDate = new Date(
          Date.parse(filter.start + 'T00:00:00Z') + (nights - 1) * 86400000,
        );
        if (!Number.isFinite(lastDate.getTime())) return false;
        const last = lastDate.toISOString().slice(0, 10);
        if (
          !p.validFrom ||
          !p.validTo ||
          filter.start < p.validFrom ||
          last > p.validTo ||
          p.unavailableDates == null
        )
          return false;
        if (p.unavailableDates.some((d) => d >= filter.start && d <= last))
          return false;
      }
    }
    return true;
  });
  const key = sort === 'paid' ? 'paid' : 'nights';
  return matches
    .sort((a, b) => {
      const av = key === 'paid' ? cumulativePaid(a) : a[key],
        bv = key === 'paid' ? cumulativePaid(b) : b[key];
      if (av == null && bv != null) return 1;
      if (av != null && bv == null) return -1;
      return (
        (av == null
          ? 0
          : direction === 'asc'
            ? av - (bv ?? 0)
            : (bv ?? 0) - av) || a.id.localeCompare(b.id)
      );
    })
    .map((record) => ({ record }));
}
