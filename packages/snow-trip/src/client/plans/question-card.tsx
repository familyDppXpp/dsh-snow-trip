import { useState } from 'react';
import { errorMessage } from '../../shared/errors.ts';
import type { PlanQuestionData } from '../../shared/plan-question.ts';
import { planQuestion } from '../../shared/plan-question.ts';
import type {
  PendingQuestion,
  PlanOutcome,
  ToolBlock,
} from '../conversation/card-types.ts';
import { PlanEditableBody } from './question-editable.tsx';
import { PlanOptionsBody } from './question-options.tsx';
import { Answer, Badge } from './question-shared.tsx';
import { PlanUpdateBody, updateOutcome } from './question-update.tsx';
export function PlanQuestionCard({
  pending,
  packages,
  snapshot,
  outcome,
}: {
  pending?: PendingQuestion;
  packages?: PlanQuestionData['packages'];
  snapshot?: PlanQuestionData;
  outcome?: PlanOutcome;
}) {
  const data = snapshot ?? planQuestion(pending);
  const readOnly = !!snapshot;
  const [collapsed, setCollapsed] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  if (!data) return null;
  const answer = async (payload: Answer) => {
    if (busy || readOnly || !pending || !data.callId) return;
    setBusy(true);
    setError('');
    try {
      await pending.answer({
        answers: [
          {
            id: data.callId,
            selected: payload.selected ?? [],
            ...(payload.custom ? { custom: payload.custom } : {}),
          },
        ],
      });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };
  const cancel = (
    <button
      className="snow-cancel-action"
      disabled={busy}
      onClick={() => answer({ selected: ['取消本次操作'] })}
    >
      取消本次操作
    </button>
  );
  const editable = data.stage === 'confirm' || data.stage === 'estimate';
  // 卡内可编辑字段会走自由输入回传：把当前编辑快照序列化进 custom，selected 承载按钮动作。
  const Editable = editable ? PlanEditableBody : null;
  const supplement = !readOnly && (
    <details className="snow-plan-message">
      <summary>
        {data.stage === 'results'
          ? '讨论或调整方案？补充说明'
          : '想调整条件？补充说明'}
      </summary>
      <div className="snow-plan-message-body">
        <label>
          继续补充想法
          <textarea
            rows={3}
            placeholder={
              data.stage === 'results'
                ? '例如：比较两份方案的雪票费用，或把预算调低一些…'
                : '例如：餐饮预算调低一些，暂不租赁雪具…'
            }
            value={message}
            disabled={busy}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <button
          disabled={busy || !message.trim()}
          onClick={() => answer({ custom: message.trim() })}
        >
          发送补充
        </button>
        <p>
          也可以直接在输入框继续说明；
          {['results', 'update'].includes(data.stage)
            ? '发送补充不会保存方案。'
            : '发送补充不会确认以上费用。'}
        </p>
      </div>
    </details>
  );
  return (
    <article
      className="snow snow-plan-card"
      aria-label={stageTitles[data.stage] || '方案卡片'}
      data-plan-stage={data.stage}
      data-collapsed={collapsed ? 'true' : undefined}
      data-planning={data.planning ? 'true' : undefined}
      data-readonly={readOnly ? 'true' : undefined}
    >
      {readOnly && (
        <div className="snow-result-outcome" role="status">
          <strong>
            {data.stage === 'update'
              ? updateOutcome(outcome)
              : outcome?.action === 'select'
                ? '已选择方案 · 已进入更新确认'
                : outcome?.action === 'save'
                  ? `已提交保存 · 已选 ${data.selected?.length ?? 0} 份 · 已保存 ${outcome.items?.filter((item) => item.status === 'saved').length ?? 0} 份`
                  : outcome?.action === 'cancel'
                    ? '已取消 · 未保存方案'
                    : '已提交补充 · 未保存方案'}
          </strong>
          {outcome?.error && <p role="alert">{outcome.error}</p>}
          {outcome?.custom && (
            <p style={{ whiteSpace: 'pre-wrap' }}>你的补充：{outcome.custom}</p>
          )}
        </div>
      )}
      <header className="snow-plan-heading">
        {!readOnly && data.stage === 'results' && (
          <button
            className="snow-plan-context-toggle"
            onClick={(event) => {
              const root =
                event.currentTarget.closest('.snow-workbench') ?? document;
              const records = [
                ...root.querySelectorAll('.snow-confirmed-plan'),
              ].filter((el) => el.getClientRects().length);
              setCollapsed(!collapsed);
              if (!collapsed)
                requestAnimationFrame(() =>
                  records.at(-1)?.scrollIntoView({ block: 'start' }),
                );
            }}
          >
            {collapsed ? '展开方案' : '查看确认条件'}
          </button>
        )}
        <Badge>{stageTitles[data.stage]}</Badge>
        {data.notice ? (
          <h3>{data.notice.title}</h3>
        ) : ['review', 'update'].includes(data.stage) && data.plan?.title ? (
          <h3>{data.plan?.title}</h3>
        ) : (
          <h3>
            {data.stage === 'results'
              ? `可选方案 · ${data.results?.length ?? 0} 份`
              : data.stage === 'estimate'
                ? '确认共同费用'
                : data.questionText || '请确认'}
          </h3>
        )}
        {!readOnly && data.stage === 'results' && (
          <p className="snow-plan-intro">
            {data.updating
              ? '选择一份方案，核对修改前后差异后更新。'
              : '查看整趟成本与每日安排，勾选后保存；也可以先比较或调整。'}
          </p>
        )}
        {data.stage === 'estimate' && (
          <p className="snow-plan-intro">
            逐项核对金额与依据，可以直接修改后再确认。
          </p>
        )}
      </header>
      {data.notice?.text && <p>{data.notice.text}</p>}
      {!readOnly && data.notice?.actions && (
        <footer className="snow-plan-actions">
          {cancel}
          {data.notice.actions.map((action, i) => (
            <button
              key={i}
              className={i === 0 ? 'primary' : ''}
              disabled={busy}
              onClick={() => answer({ selected: [action.label] })}
            >
              {action.label}
            </button>
          ))}
        </footer>
      )}
      {Editable && (
        <Editable
          data={data}
          packages={packages ?? data.packages}
          busy={busy}
          error={error}
          onAnswer={answer}
          cancel={cancel}
          readOnly={readOnly}
        />
      )}
      {data.stage === 'update' && (
        <PlanUpdateBody
          data={data}
          busy={busy}
          onAnswer={answer}
          cancel={cancel}
          readOnly={readOnly}
          outcome={outcome}
          supplement={supplement}
          error={error}
        />
      )}
      {!Editable && data.stage !== 'update' && !data.notice?.actions && (
        <PlanOptionsBody
          data={data}
          busy={busy}
          error={error}
          onAnswer={answer}
          cancel={cancel}
          readOnly={readOnly}
        />
      )}
      {error && !Editable && data.stage !== 'update' && (
        <p role="alert">{error}</p>
      )}
      {data.stage !== 'update' && supplement}
    </article>
  );
}

export const stageTitles = {
  confirm: '01 · 确认这次出行',
  estimate: '02 · 确认计算依据',
  results: '03 · 找到合适的搭配',
  discussion: '一起继续想',
  update: '确认更新方案',
  review: '已存方案 · 保存时快照',
  status: '',
};

export function PlanStageFailure({ block }: { block?: ToolBlock }) {
  if (!block?.isError) return null;
  const message = (block.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join('\n');
  return (
    <article className="snow snow-plan-card" role="alert">
      <h3>方案卡片未生成</h3>
      <p>{message || '卡片数据校验失败，请修正后重新生成。'}</p>
    </article>
  );
}
