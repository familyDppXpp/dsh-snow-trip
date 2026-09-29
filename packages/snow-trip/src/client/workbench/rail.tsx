import { useEffect, useRef } from 'react';
import { Icon } from '../ui/icon.tsx';
import { Children } from '../ui/modal.tsx';
export function SessionRail({
  mobile,
  open,
  onClose,
  width,
  children,
}: Children & {
  mobile: boolean;
  open: boolean;
  onClose: () => void;
  width: number;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!mobile) return;
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [mobile, open]);
  if (!mobile)
    return (
      <div className="snow snow-rail" style={{ width }}>
        {children}
      </div>
    );
  return (
    <dialog
      ref={dialog}
      className="snow snow-rail snow-mobile-rail"
      aria-label="雪季导航"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        className="snow-rail-close"
        aria-label="关闭菜单"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
      {children}
    </dialog>
  );
}
