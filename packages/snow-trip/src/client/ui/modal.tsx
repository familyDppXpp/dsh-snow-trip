import React, { useEffect, useId, useRef } from 'react';
import { Icon } from './icon.tsx';
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  dismissible = true,
}: Children & {
  title: string;
  onClose: () => void;
  wide?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`snow-modal snow ${wide ? 'wide' : ''}`}
      aria-label={title}
      onClose={onClose}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault();
      }}
      onClick={(e) => {
        if (dismissible && e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          aria-label="关闭"
          disabled={!dismissible}
          className="icon-button"
          onClick={() => ref.current?.close()}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="modal-body">{children}</div>
    </dialog>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<{ id?: string }>;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {React.cloneElement(children, { id })}
    </div>
  );
}

export type Children = { children: React.ReactNode };
