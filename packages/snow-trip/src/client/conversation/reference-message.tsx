import type {
  RenderMessageImages,
  UserMessageNode,
} from '@deepseek-ai/dsh-client-ui-conversation/client';
import React, { useEffect, useMemo, useState } from 'react';
import type {
  Context,
  NamedRecord,
  RecordReference,
  SnowRemote,
} from '../integration/types.ts';
import { splitRecordReferences } from './references.ts';

function RecordChip({
  reference,
  remote,
}: {
  reference: RecordReference;
  remote: SnowRemote;
}) {
  const { type, id } = reference;
  const [record, setRecord] = useState<NamedRecord | null>(null);
  useEffect(() => {
    let active = true;
    setRecord(null);
    (type === 'package' ? remote.getPackage(id) : remote.getPlan(id))
      .then((result) => {
        if (active && result.ok) setRecord(result.value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [remote, type, id]);
  const kind = type === 'package' ? '套餐' : '方案';
  const name = record?.name ?? record?.title ?? id.slice(0, 8);
  return (
    <button
      type="button"
      className="snow-message-ref"
      data-snow-reference={type}
      data-snow-reference-id={id}
      title={`${kind}：${name}\nID：${id}`}
    >
      <span className="snow-message-ref-marker" aria-hidden="true">
        @
      </span>
      <span className="snow-message-ref-name">
        {kind}：{name}
      </span>
    </button>
  );
}

export function ReferenceMessage({
  node,
  renderMessageImages,
  remote,
}: {
  node: { data: Pick<UserMessageNode, 'content' | 'time'> };
  renderMessageImages: RenderMessageImages;
  remote: SnowRemote;
}) {
  const { content, time } = node.data;
  const text = content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  const parts = useMemo(() => splitRecordReferences(text), [text]);
  const attachments = content.filter(
    (block) => block.type === 'image' || block.type === 'file',
  );
  const [copyStatus, setCopyStatus] = useState('');
  return (
    <div className="snow-reference-message">
      <div className="snow-reference-message-stack">
        {attachments.length > 0 && (
          <div className="snow-reference-attachments">
            {attachments.map((block, index) =>
              block.type === 'image' ? (
                <React.Fragment key={index}>
                  {renderMessageImages({
                    images: [{ attachment: block.attachment }],
                    align: 'end',
                    compact: attachments.length > 1,
                  })}
                </React.Fragment>
              ) : (
                <span
                  className="snow-reference-file"
                  key={index}
                  title={block.attachment.name}
                >
                  {block.attachment.name}
                </span>
              ),
            )}
          </div>
        )}
        <div className="snow-reference-bubble">
          {parts.map((part, index) =>
            typeof part === 'string' ? (
              part
            ) : (
              <RecordChip key={index} reference={part} remote={remote} />
            ),
          )}
          {content
            .filter((block) => !['text', 'image', 'file'].includes(block.type))
            .map((block, index) => (
              <pre key={index}>{JSON.stringify(block, null, 2)}</pre>
            ))}
        </div>
      </div>
      <div className="snow-reference-message-actions">
        {time !== undefined && (
          <time
            dateTime={new Date(time).toISOString()}
            title={new Date(time).toLocaleString()}
          >
            {new Date(time).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
          </time>
        )}
        <button
          type="button"
          aria-label="复制消息"
          title="复制消息"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopyStatus('已复制');
            } catch {
              setCopyStatus('复制失败，请重试');
            }
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect x="4" y="7" width="13" height="13" rx="3" />
            <path d="M8 4h9a3 3 0 0 1 3 3v9" />
          </svg>
        </button>
        <span role="status">{copyStatus}</span>
      </div>
    </div>
  );
}

export function registerReferenceMessages(ctx: Context) {
  for (const key of ['user', 'steering'] as const)
    ctx.slots.inject('conversation.chat.node', () =>
      ctx.slots.register(
        {
          name: 'conversation.chat.node',
          key,
          priority: -1,
        },
        (props) => <ReferenceMessage {...props} remote={ctx.remote.snowTrip} />,
      ),
    );
}
