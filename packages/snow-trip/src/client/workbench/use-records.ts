import { useEffect, useState } from 'react';
import { errorMessage } from '../../shared/errors.ts';
import type { Actions, PlanRecord } from '../integration/types.ts';
import type { Ledger } from '../packages/ledger.ts';
import { usePackages } from '../packages/use-packages.ts';
import { storage } from './storage.ts';

export function useWorkbenchRecords(
  actions: Actions,
  view: string,
  planSessionVersion: string,
) {
  const [hostSaved, setHostSaved] = useState<PlanRecord[]>([]),
    [plansError, setPlansError] = useState(''),
    [plansLoaded, setPlansLoaded] = useState(false),
    [plansRefresh, setPlansRefresh] = useState(0);
  const [ledger, setLedger] = useState<Ledger | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setPlansLoaded(false);
    setPlansError('');
    actions
      .listPlans()
      .then((rows) => {
        if (active) {
          setHostSaved(
            rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          );
          setPlansLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setPlansError(errorMessage(e));
      });
    return () => {
      active = false;
    };
  }, [view, plansRefresh, planSessionVersion]);
  useEffect(() => {
    let active = true;
    storage<Ledger>('ledger')
      .then((l) => {
        if (active) setLedger(l || null);
      })
      .catch(() => {
        if (active)
          setError('无法读取本机资料，请检查浏览器是否允许站点存储后重试。');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const host = usePackages(actions, `${view}:${planSessionVersion}`);
  return {
    host,
    hostSaved,
    setHostSaved,
    plansError,
    plansLoaded,
    setPlansRefresh,
    ledger,
    loading,
    error,
  };
}
