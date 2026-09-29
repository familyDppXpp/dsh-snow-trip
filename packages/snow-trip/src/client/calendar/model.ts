import type { PackageRecord } from '../../shared/packages.ts';
import type { PlanRecord } from '../../shared/plans.ts';
import { date, plusDays } from '../packages/ledger.ts';
export interface CalendarDay {
  packages: PackageRecord[];
  pendingPackages: PackageRecord[];
  plans: PlanRecord[];
}
export interface MonthRange {
  start: string;
  end: string;
}

const unique = <T extends { id: string }>(rows: T[]) => [
  ...new Map(rows.map((row) => [row.id, row])).values(),
];
const excluded = (p: PackageRecord) =>
  p.voided === true ||
  (p.nights != null && p.usedNights != null && p.nights - p.usedNights <= 0);
const hasBoundary = (p: PackageRecord) =>
  !!(date(p.validFrom) || date(p.validTo));
export const localDay = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

function tripRange({
  start,
  nights,
}: {
  start: string | null;
  nights: number | null;
}): [string, string] | null {
  const first = date(start);
  return first &&
    nights != null &&
    Number.isInteger(nights) &&
    nights >= 1 &&
    nights <= 366
    ? [first, plusDays(first, nights)]
    : null;
}
export function planDateRanges(plan: PlanRecord) {
  const total = tripRange(plan);
  return total
    ? [total]
    : (plan.items ?? [])
        .map(tripRange)
        .filter((range): range is [string, string] => range !== null);
}

export function calendarDay(
  packages: PackageRecord[],
  plans: PlanRecord[],
  day: string,
) {
  const result: CalendarDay = { packages: [], pendingPackages: [], plans: [] };
  for (const p of unique(packages)) {
    const from = date(p.validFrom),
      to = date(p.validTo);
    if (
      excluded(p) ||
      !hasBoundary(p) ||
      (from && day < from) ||
      (to && day > to) ||
      p.unavailableDates?.includes(day)
    )
      continue;
    result[
      from && to && Array.isArray(p.unavailableDates)
        ? 'packages'
        : 'pendingPackages'
    ].push(p);
  }
  result.plans = unique(plans).filter((plan) =>
    planDateRanges(plan).some(([start, end]) => start <= day && day <= end),
  );
  return result;
}
export function undatedRecords(packages: PackageRecord[], plans: PlanRecord[]) {
  return {
    packages: unique(packages).filter((p) => !excluded(p) && !hasBoundary(p)),
    plans: unique(plans).filter((p) => !planDateRanges(p).length),
  };
}

export function filterCalendarDay(day: CalendarDay, filters: string[]) {
  const show = (type: string) => !filters.length || filters.includes(type);
  return {
    plans: day.plans.filter((p) =>
      show(p.tracking?.booking === 'confirmed' ? 'confirmed' : 'draft'),
    ),
    packages: show('packages') ? day.packages : [],
    pendingPackages: show('pending') ? day.pendingPackages : [],
  };
}
export const defaultMonthRange = { start: '2026-12', end: '2027-03' };
export const validMonthRange = (value: unknown): value is MonthRange =>
  !!value &&
  typeof value === 'object' &&
  'start' in value &&
  'end' in value &&
  typeof value.start === 'string' &&
  typeof value.end === 'string' &&
  [value.start, value.end].every(
    (month) =>
      typeof month === 'string' && /^202[67]-(0[1-9]|1[0-2])$/.test(month),
  ) &&
  value.start <= value.end;
export function seasonCalendar(
  packages: PackageRecord[],
  plans: PlanRecord[],
  start = defaultMonthRange.start,
  end = defaultMonthRange.end,
) {
  if (!validMonthRange({ start, end }))
    throw new Error('月份区间须在 2026–2027 年内，且开始月不晚于结束月');
  const months = [];
  for (
    let month = new Date(`${start}-01T00:00:00`);
    localDay(month).slice(0, 7) <= end;
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  )
    months.push(month);
  const days = new Map<string, CalendarDay>(),
    packageIds = new Set(),
    planIds = new Set();
  let plannedDays = 0;
  for (const month of months) {
    const last = new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0,
    ).getDate();
    for (let d = 1; d <= last; d++) {
      const key = localDay(new Date(month.getFullYear(), month.getMonth(), d)),
        value = calendarDay(packages, plans, key);
      days.set(key, value);
      value.packages.forEach((p) => packageIds.add(p.id));
      value.plans.forEach((p) => planIds.add(p.id));
      if (value.plans.length) plannedDays++;
    }
  }
  return {
    months,
    days,
    packageCount: packageIds.size,
    planCount: planIds.size,
    plannedDays,
  };
}
