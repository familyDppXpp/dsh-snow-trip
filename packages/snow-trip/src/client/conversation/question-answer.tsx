import type { AskUserQuestionItem } from '@deepseek-ai/dsh-user-questions';
import { useId, useState } from 'react';
import type { QuestionRecord } from './card-types.ts';
export function QuestionAnswerCard({ data }: { data: QuestionRecord }) {
  const [active, setActive] = useState(0),
    id = useId();
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const answer = (q: AskUserQuestionItem) =>
    data.answers?.find((a) => a.id === q.id);
  const answered = (q: AskUserQuestionItem) => {
    const a = answer(q);
    return !!(a?.selected?.length || a?.custom);
  };
  return (
    <article className="snow snow-question-record" aria-label="提问回答记录">
      <div
        className="snow-question-tabs"
        role="tablist"
        aria-label="已提交的问题"
      >
        {questions.map((q, i) => (
          <button
            type="button"
            role="tab"
            key={q.id ?? i}
            id={`${id}-tab-${i}`}
            aria-controls={`${id}-panel-${i}`}
            aria-selected={active === i}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (i + 1) % questions.length
                  : event.key === 'ArrowLeft'
                    ? (i + questions.length - 1) % questions.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? questions.length - 1
                        : null;
              if (next !== null) {
                event.preventDefault();
                setActive(next);
                (
                  event.currentTarget.parentElement?.children[next] as
                    | HTMLElement
                    | undefined
                )?.focus();
              }
            }}
          >
            {q.header || `问题 ${i + 1}`}
            <span className="snow-question-tab-status">
              {answered(q) ? '✓' : answer(q) ? '已跳过' : '未回答'}
            </span>
          </button>
        ))}
      </div>
      {questions.map((q, i) => {
        const a = answer(q),
          selected = Array.isArray(a?.selected) ? a.selected : [],
          options = Array.isArray(q.options) ? q.options : [];
        return (
          <section
            key={q.id ?? i}
            role="tabpanel"
            id={`${id}-panel-${i}`}
            aria-labelledby={`${id}-tab-${i}`}
            hidden={active !== i}
            tabIndex={0}
          >
            <p className="snow-question-prompt">{q.question}</p>
            {q.detail && <p className="snow-question-detail">{q.detail}</p>}
            <div className="snow-question-options">
              {options.map((option, j) => {
                const label =
                    typeof option === 'string' ? option : option.label,
                  chosen = selected.includes(label);
                return (
                  <div
                    key={j}
                    className={`snow-question-option${chosen ? ' is-selected' : ''}`}
                    aria-label={`${label}，${chosen ? '已选择' : '未选择'}`}
                  >
                    <span className="snow-question-number">{j + 1}</span>
                    <div>
                      <strong>{label}</strong>
                      {typeof option !== 'string' && option.description && (
                        <p>{option.description}</p>
                      )}
                    </div>
                    {chosen && (
                      <span className="snow-question-check" aria-label="已选择">
                        ✓
                      </span>
                    )}
                  </div>
                );
              })}
              {selected
                .filter(
                  (label) =>
                    !options.some(
                      (o) => (typeof o === 'string' ? o : o.label) === label,
                    ),
                )
                .map((label, j) => (
                  <div
                    key={`extra-${j}`}
                    className="snow-question-option is-selected"
                  >
                    <span aria-hidden="true">✓</span>
                    <strong>{label}</strong>
                  </div>
                ))}
              <div
                className={`snow-question-option snow-question-custom${a?.custom ? ' is-selected' : ''}`}
              >
                <span aria-hidden="true">✎</span>
                <div>
                  <strong>其他（自由输入）</strong>
                  <p>{a?.custom ? `补充：${a.custom}` : '未填写'}</p>
                </div>
                {a?.custom && (
                  <span className="snow-question-check" aria-label="已填写">
                    ✓
                  </span>
                )}
              </div>
            </div>
            <footer className="snow-question-verdict">
              <span>
                {i + 1} / {questions.length}
              </span>
              <button disabled>
                {answered(q) ? '已提交' : a ? '已跳过' : '未回答'}
              </button>
            </footer>
          </section>
        );
      })}
    </article>
  );
}
