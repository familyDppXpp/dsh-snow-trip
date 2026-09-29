import { useState } from 'react';
import { errorMessage } from '../../shared/errors.ts';
import { Field, Modal } from '../ui/modal.tsx';

export function RenameSessionDialog({
  initialTitle,
  busy: sessionBusy,
  onBusy: setSessionBusy,
  onRename,
  onClose,
}: {
  initialTitle: string;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onRename: (title: string) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialTitle),
    [renameError, setRenameError] = useState('');
  return (
    <Modal
      title="编辑会话标题"
      dismissible={!sessionBusy}
      onClose={() => onClose()}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (sessionBusy) return;
          if (!title.trim()) {
            setRenameError('请输入会话标题。');
            return;
          }
          setSessionBusy(true);
          setRenameError('');
          try {
            await onRename(title);
            onClose();
          } catch (error) {
            setRenameError('保存失败：' + errorMessage(error));
          } finally {
            setSessionBusy(false);
          }
        }}
      >
        <Field label="会话标题">
          <input
            autoFocus
            value={title}
            disabled={sessionBusy}
            onFocus={(event) => event.target.select()}
            onChange={(event) => {
              setTitle(event.target.value);
              setRenameError('');
            }}
          />
        </Field>
        {renameError && (
          <p className="error" role="alert">
            {renameError}
          </p>
        )}
        <div className="modal-actions">
          <button
            type="button"
            disabled={sessionBusy}
            onClick={() => onClose()}
          >
            取消
          </button>
          <button type="submit" className="primary" disabled={sessionBusy}>
            {sessionBusy ? '正在保存…' : '保存标题'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
