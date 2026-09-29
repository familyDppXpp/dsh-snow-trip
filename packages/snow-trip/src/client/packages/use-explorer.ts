import React, { useMemo, useRef, useState } from 'react';
import type { PackageRecord, PlanRecord } from '../integration/types.ts';
import { packageCandidates, packageStats } from '../packages/filter.ts';
import { initial } from '../packages/filters.tsx';
import type { Evaluation, Ledger } from '../packages/ledger.ts';
import { date, evaluate } from '../packages/ledger.ts';

export function usePackageExplorer({
  ledger,
  records,
  hostSaved,
  plansLoaded,
  plansError,
  setNotice,
}: {
  ledger: Ledger | null;
  records: PackageRecord[];
  hostSaved: PlanRecord[];
  plansLoaded: boolean;
  plansError: string;
  setNotice: (message: string) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState(initial),
    [filter, setFilter] = useState(initial),
    [selection, setSelection] = useState<string[]>([]),
    [sort, setSort] = useState('paid'),
    [sortDirection, setSortDirection] = useState('desc');
  const [detail, setDetail] = useState<Evaluation | null>(null),
    [comparing, setComparing] = useState(false),
    [formError, setFormError] = useState('');
  const startInput = useRef<HTMLButtonElement | null>(null);
  const stats = useMemo(() => packageStats(records), [records]);
  const planFilterPending = filter.hasPlan && (!plansLoaded || plansError);
  const candidates = useMemo(
    () =>
      planFilterPending
        ? []
        : packageCandidates(records, filter, sort, hostSaved, sortDirection),
    [planFilterPending, records, filter, sort, hostSaved, sortDirection],
  );
  const packages = ledger?.packages || [];
  const evaluated = useMemo(
    () =>
      filter.start
        ? packages.map((p) =>
            evaluate(
              p,
              filter.start,
              filter.nights ? Number(filter.nights) : undefined,
            ),
          )
        : [],
    [ledger, filter.start, filter.nights],
  );
  const results = evaluated
    .filter(
      (r) =>
        (filter.region === '全部目的地' || r.pkg.region === filter.region) &&
        (!filter.query ||
          (r.pkg.name + r.pkg.hotel + r.pkg.resort)
            .toLowerCase()
            .includes(filter.query.toLowerCase())),
    )
    .sort((a, b) =>
      sort === 'surcharge'
        ? (a.amount ?? Infinity) - (b.amount ?? Infinity)
        : sort === 'nights'
          ? b.pkg.nights - a.pkg.nights
          : a.pkg.id.localeCompare(b.pkg.id),
    );
  const chosen = evaluated.filter((r) => selection.includes(r.pkg.id));

  function toggle(id: string) {
    if (selection.includes(id)) setSelection(selection.filter((x) => x !== id));
    else if (selection.length < 3) setSelection([...selection, id]);
    else setNotice('最多对比 3 个方案，请先移除一个。');
  }
  function search(e: React.FormEvent) {
    e.preventDefault();
    if (
      (form.start !== '' && !date(form.start)) ||
      (form.nights !== '' &&
        (!Number.isInteger(Number(form.nights)) ||
          Number(form.nights) < 1 ||
          Number(form.nights) > 366))
    ) {
      setFormError('请填写有效入住日期或留空，住宿晚数应为 1–366 晚。');
      startInput.current?.focus();
      return;
    }
    setFormError('');
    setFilter({ ...form, query: form.query.trim() });
    setNotice('已按当前条件更新候选方案。');
    setFiltersOpen(false);
  }

  return {
    filtersOpen,
    setFiltersOpen,
    form,
    setForm,
    filter,
    setFilter,
    selection,
    setSelection,
    sort,
    setSort,
    sortDirection,
    setSortDirection,
    detail,
    setDetail,
    comparing,
    setComparing,
    formError,
    startInput,
    stats,
    planFilterPending,
    candidates,
    results,
    chosen,
    toggle,
    search,
  };
}
