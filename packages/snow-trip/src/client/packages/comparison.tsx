import { Comparison, Detail } from '../packages/ledger-dialogs.tsx';
import { Icon } from '../ui/icon.tsx';

import { usePackageExplorer } from './use-explorer.ts';
export function PackageComparison({
  active,
  explorer,
}: {
  active: boolean;
  explorer: ReturnType<typeof usePackageExplorer>;
}) {
  const {
    selection,
    setSelection,
    chosen,
    setComparing,
    comparing,
    filter,
    detail,
    setDetail,
  } = explorer;
  return (
    <>
      {' '}
      {selection.length > 0 && active && (
        <div className="compare-bar">
          <div>
            <Icon name="compare" />
            <b>已选 {selection.length} / 3</b>
            <span>
              {chosen.map((r) => r.pkg.hotel.split('（')[0]).join(' · ')}
            </span>
          </div>
          <button className="text-button" onClick={() => setSelection([])}>
            清空
          </button>
          <button className="primary" onClick={() => setComparing(true)}>
            对比与规划 <Icon name="arrow" size={17} />
          </button>
        </div>
      )}{' '}
      {comparing && (
        <Comparison
          results={chosen}
          filter={filter}
          onClose={() => setComparing(false)}
        />
      )}
      {detail && <Detail result={detail} onClose={() => setDetail(null)} />}
    </>
  );
}
