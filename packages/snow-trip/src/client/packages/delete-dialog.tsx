import { useState } from 'react';
import { errorMessage } from '../../shared/errors.ts';
import type {
  Actions,
  PackageRecord,
  PlanRecord,
} from '../integration/types.ts';
import { Modal } from '../ui/modal.tsx';

export type PackageDeletion = {
  record: PackageRecord;
  plans: PlanRecord[];
  archive: boolean;
};
export function DeletePackageDialog({
  pending: pendingDelete,
  busy: deleteBusy,
  onBusy: setDeleteBusy,
  deletePackage,
  onDeleted,
  onRefresh,
  onClose,
}: {
  pending: PackageDeletion;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  deletePackage: Actions['deletePackage'];
  onDeleted: (message: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}) {
  const [deleteError, setDeleteError] = useState('');
  return (
    <Modal title="删除套餐" dismissible={!deleteBusy} onClose={() => onClose()}>
      <p>确定删除“{pendingDelete.record.name}”吗？删除后无法恢复。</p>
      {pendingDelete.plans.length > 0 && (
        <div>
          <p>
            以下 {pendingDelete.plans.length}{' '}
            份方案引用了此套餐，将一并永久删除（包括同时引用其他套餐的方案）：
          </p>
          <ul>
            {pendingDelete.plans.map((plan) => (
              <li key={plan.id}>
                {plan.title}
                {plan.start ? ` · ${plan.start} 入住` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pendingDelete.plans.length > 0 && (
        <p>
          {pendingDelete.archive
            ? '这是该会话关联的最后一个套餐，删除后会同时归档会话。'
            : '该会话还关联其他套餐或方案，不会归档。'}
          受影响方案的会话若不再关联任何资料，也会自动归档。聊天记录保留。
        </p>
      )}
      {deleteError && (
        <p className="error" role="alert">
          {deleteError}
        </p>
      )}
      <div className="modal-actions">
        <button autoFocus disabled={deleteBusy} onClick={() => onClose()}>
          取消
        </button>
        <button
          disabled={deleteBusy}
          className="primary"
          onClick={async () => {
            if (deleteBusy) return;
            setDeleteBusy(true);
            setDeleteError('');
            try {
              onDeleted(
                await deletePackage(
                  pendingDelete.record,
                  pendingDelete.archive,
                  pendingDelete.plans,
                ),
              );
              onClose();
            } catch (error) {
              setDeleteError(errorMessage(error));
            } finally {
              setDeleteBusy(false);
              onRefresh();
            }
          }}
        >
          {deleteBusy ? '正在删除…' : '确认删除'}
        </button>
      </div>
    </Modal>
  );
}
