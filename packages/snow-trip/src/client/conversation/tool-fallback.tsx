import type { ToolBlock } from './card-types.ts';
export function PlanFallback({
  block,
  label = '工具结果',
}: {
  block?: ToolBlock;
  label?: string;
}) {
  const content = Array.isArray(block?.content)
    ? block.content
        .filter((c) => c?.type === 'text' && typeof c.text === 'string')
        .map((c) => c.text)
        .join('\n')
    : '';
  return (
    <details>
      <summary>
        {label} ·{' '}
        {block?.isError
          ? '失败'
          : block && 'kind' in block
            ? '工具结果'
            : '等待结果'}
      </summary>
      <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        {content || '暂无结果'}
      </pre>
    </details>
  );
}
