import { purchaseLabels } from '../../shared/packages.ts';
import { TagFilter } from '../ui/filters.tsx';
import type { PackageFilter } from './filter.ts';
export function PackageTagFilter({
  value,
  onChange,
}: {
  value: PackageFilter;
  onChange: (value: PackageFilter) => void;
}) {
  return (
    <TagFilter
      label="套餐标签"
      value={value}
      onChange={onChange}
      groups={[
        ['purchaseStatuses', '购买状态', Object.entries(purchaseLabels)],
        [
          'completeness',
          '资料完整度',
          [
            ['complete', '资料完整'],
            ['incomplete', '待补全'],
          ],
        ],
      ]}
    />
  );
}

export const initial: PackageFilter = {
  start: '',
  nights: '',
  region: '全部目的地',
  query: '',
  purchaseStatuses: [],
  completeness: [],
  hasPlan: '',
};
