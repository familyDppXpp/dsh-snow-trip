import type {
  PropsRenderSlots,
  SessionProviderComponent,
} from '@deepseek-ai/dsh-client-ui-slots';
import React, { useEffect, useRef, useState } from 'react';
import { SessionFeedback } from '../conversation/feedback.tsx';
import type { Actions, RecordReference } from '../integration/types.ts';
import { Modal } from '../ui/modal.tsx';

import type { SessionReference } from '../integration/types.ts';
export function ConversationPanel({
  actions,
  currentId,
  reference,
  SessionProvider,
  renderSlot,
  onReference,
  onOpenSidebar,
  children,
}: {
  actions: Actions;
  currentId: string;
  reference: SessionReference | undefined;
  SessionProvider: SessionProviderComponent;
  renderSlot: PropsRenderSlots<'main'>['renderSlot'];
  onReference: (reference: RecordReference) => void;
  onOpenSidebar: () => void;
  children: React.ReactNode;
}) {
  const conversation = useRef<HTMLDivElement>(null);
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    alt: string;
  } | null>(null);
  useEffect(() => {
    const root = conversation.current;
    if (!root) return;
    const decorate = () =>
      root
        .querySelectorAll<HTMLElement>('[data-composer-chip="snow-record"]')
        .forEach((chip) => {
          chip.setAttribute('role', 'button');
          chip.tabIndex = 0;
          chip.setAttribute(
            'aria-label',
            `查看详情：${(chip.textContent ?? '').replace(/^@/, '')}`,
          );
        });
    const observer = new MutationObserver(decorate);
    observer.observe(root, { childList: true, subtree: true });
    decorate();
    return () => observer.disconnect();
  }, [currentId]);
  useEffect(() => {
    if (currentId)
      requestAnimationFrame(() =>
        conversation.current
          ?.querySelector<HTMLElement>('[contenteditable="true"]')
          ?.focus(),
      );
  }, [currentId]);
  const openClickedReference = (event: React.SyntheticEvent) => {
    const sent = (event.target as Element).closest<HTMLElement>(
      '[data-snow-reference-id]',
    );
    const chip = (event.target as Element).closest<HTMLElement>(
      '[data-composer-chip="snow-record"]',
    );
    let ref: RecordReference | null =
      sent?.dataset.snowReferenceId &&
      (sent.dataset.snowReference === 'package' ||
        sent.dataset.snowReference === 'plan')
        ? { type: sent.dataset.snowReference, id: sent.dataset.snowReferenceId }
        : null;
    if (chip) {
      const editor = chip.closest('[contenteditable="true"]');
      ref = actions.referenceAt(
        currentId,
        [...editor!.querySelectorAll('[data-composer-chip]')].indexOf(chip),
      );
    }
    if (!ref) return false;
    event.preventDefault();
    event.stopPropagation();
    onReference(ref);
    onOpenSidebar();
    return true;
  };

  return (
    <>
      <main className="snow-session-main">
        <div className="snow">
          {actions.sessionState(currentId) && (
            <SessionFeedback state={actions.sessionState(currentId)!} />
          )}
        </div>
        <div className="snow-session-layout">
          <div
            className="snow-conversation"
            ref={conversation}
            onKeyDownCapture={(event) => {
              if (
                (event.key === 'Enter' || event.key === ' ') &&
                (event.target as Element).matches(
                  '[data-composer-chip="snow-record"]',
                )
              )
                openClickedReference(event);
            }}
            onClickCapture={(event) => {
              if (openClickedReference(event)) return;
              // 宿主图片灯箱使用 body portal，会被工作台原生 dialog 遮挡；复用宿主图片 URL 在内层 dialog 预览。
              const image = (event.target as Element)
                .closest('button')
                ?.querySelector('img');
              if (image) {
                event.preventDefault();
                event.stopPropagation();
                setImagePreview({
                  src: image.currentSrc || image.src,
                  alt: image.alt,
                });
              }
            }}
          >
            <SessionProvider session={reference}>
              {renderSlot('main', {}, { entryKey: 'conversation' })}
            </SessionProvider>
          </div>
          {children}
        </div>
      </main>{' '}
      {imagePreview && (
        <Modal title="截图预览" onClose={() => setImagePreview(null)} wide>
          <img
            src={imagePreview.src}
            alt={imagePreview.alt}
            style={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: '70vh',
              margin: 'auto',
            }}
          />
        </Modal>
      )}
    </>
  );
}
