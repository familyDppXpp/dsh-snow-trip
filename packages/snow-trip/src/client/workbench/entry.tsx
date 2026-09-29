import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../shared/errors.ts';

export type Mount = (container: HTMLElement) => () => void;
export function Entry({
  wide,
  prepare,
}: {
  wide?: boolean;
  prepare: (close: () => void) => Promise<Mount>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    container = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(() =>
      [window.location.search, window.location.hash.slice(1)].some(
        (part) => new URLSearchParams(part).get('app') === 'snow-trip',
      ),
    ),
    [error, setError] = useState('');
  useEffect(() => {
    if (!opened) return;
    dialog.current?.showModal();
    let active = true,
      unmount: (() => void) | undefined;
    prepare(() => dialog.current?.close())
      .then((mount) => {
        if (active) unmount = mount(container.current!);
      })
      .catch((error) => {
        if (active) setError(`工作台加载失败：${errorMessage(error)}`);
      });
    return () => {
      active = false;
      unmount?.();
    };
  }, [opened, prepare]);
  return (
    <>
      <button
        className="snow-entry"
        aria-label="打开雪季出行工作台"
        title="雪季出行工作台"
        onClick={() => {
          setError('');
          setOpened(true);
        }}
      >
        △{wide && ' 雪季出行'}
      </button>
      <dialog
        className="snow-shell"
        ref={dialog}
        aria-label="雪季出行工作台"
        onClose={(event) => {
          if (event.target === dialog.current) setOpened(false);
        }}
      >
        {error && (
          <div className="snow" role="alert">
            {error}
            <button onClick={() => dialog.current?.close()}>返回 DSH</button>
          </div>
        )}
        <div ref={container} className="snow-mount" />
      </dialog>
    </>
  );
}
