import { useState } from 'react';
import { errorMessage } from '../../shared/errors.ts';
import type {
  Actions,
  PackageRecord,
  PlanRecord,
} from '../integration/types.ts';
import { Modal } from '../ui/modal.tsx';

export function DeletePlanDialog({
  plan: pendingPlanDelete,
  plans: hostSaved,
  packages,
  busy: deleteBusy,
  onBusy: setDeleteBusy,
  deletePlan,
  onDeleted,
  onClose,
}: {
  plan: PlanRecord;
  plans: PlanRecord[];
  packages: PackageRecord[];
  busy: boolean;
  onBusy: (busy: boolean) => void;
  deletePlan: Actions['deletePlan'];
  onDeleted: (id: string, message: string) => void;
  onClose: () => void;
}) {
  const [deleteError, setDeleteError] = useState('');
  return (
    <Modal title="删除方案" dismissible={!deleteBusy} onClose={() => onClose()}>
      <p>确定删除“{pendingPlanDelete.title}”吗？删除后无法恢复。</p>
      <p>
        {hostSaved.some(
          (plan) =>
            plan.id !== pendingPlanDelete.id &&
            plan.sessionId === pendingPlanDelete.sessionId,
        ) ||
        packages.some(
          (record) => record.sessionId === pendingPlanDelete.sessionId,
        )
          ? '该会话还关联其他套餐或方案，不会归档。'
          : '删除后会自动归档关联会话。'}
        套餐和聊天记录保留。
      </p>
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
              const message = await deletePlan(pendingPlanDelete.id);
              onDeleted(pendingPlanDelete.id, message || '方案已删除。');
              onClose();
            } catch (error) {
              setDeleteError('删除失败：' + errorMessage(error));
            } finally {
              setDeleteBusy(false);
            }
          }}
        >
          {deleteBusy ? '正在删除…' : '确认删除'}
        </button>
      </div>
    </Modal>
  );
}
