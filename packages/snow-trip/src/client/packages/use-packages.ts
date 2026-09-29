import { useEffect, useState } from 'react';
import type { Actions, PackageRecord } from '../integration/types.ts';
export function usePackages(
  actions: Pick<Actions, 'listPackages'>,
  refreshKey: string,
) {
  const [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<PackageRecord[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    actions
      .listPackages()
      .then((rows) => {
        if (active) setRows(rows);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [actions, refreshKey, attempt]);
  return {
    rows,
    error,
    loading,
    retry: () => setAttempt((value) => value + 1),
  };
}
