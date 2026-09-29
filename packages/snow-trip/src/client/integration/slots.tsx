import { planQuestion } from '../../shared/plan-question.ts';
import { saveTurnDefinition } from '../conversation/projections.ts';
import { registerReferenceMessages } from '../conversation/reference-message.tsx';

import type { Context } from '../integration/types.ts';
import { SaveCard, SaveCards, saveQuestion } from '../packages/save-card.tsx';
import { PlanQuestionCard } from '../plans/question-card.tsx';

import { confirmedPlanDefinition } from '../conversation/projections.ts';

import { PlanInteractionCard } from '../plans/interaction-card.tsx';

export function registerConfirmedPlan(ctx: Context) {
  ctx.uiConversation.events.register(confirmedPlanDefinition);
  ctx.slots.inject('conversation.chat.node', () =>
    ctx.slots.register(
      { name: 'conversation.chat.node', key: 'snow-confirmed-plan' },
      ({ node }) =>
        node.data.version === 2 ? (
          <div className="snow snow-save-cards">
            <SaveCard item={{ done: true, meta: node.data }} />
          </div>
        ) : (
          <PlanInteractionCard data={node.data} />
        ),
    ),
  );
}

export function registerConversationCards(ctx: Context, id: string) {
  ctx.uiConversation.events.register(saveTurnDefinition);
  ctx.slots.inject('conversation.chat.turnTail', () =>
    ctx.slots.register(
      { name: 'conversation.chat.turnTail', id, priority: -1 },
      ({ turn, sessionId }) => {
        const items = turn.data
          .get('snowSaves')
          ?.filter((item) => item.stopped);
        return items?.length ? (
          <SaveCards
            items={items}
            store={ctx.uiSession.sessionStatus}
            sessionId={sessionId}
          />
        ) : null;
      },
    ),
  );
  registerConfirmedPlan(ctx);
  registerReferenceMessages(ctx);
  // 主界面（工作台弹窗外）也渲染方案阶段卡片：DSH 主会话的 pendingInteraction
  // 由宿主通用 QuestionComposer 显示为选项列表；这里注册方案卡识别，优先级与
  // 工作台内一致（-1，先于宿主通用 composer，同 saveQuestion 的做法）。
  ctx.slots.inject('conversation.composer', () =>
    ctx.slots.register(
      {
        name: 'conversation.composer',
        priority: -1,
        select: ({ pendingInteraction }) =>
          planQuestion(pendingInteraction) || saveQuestion(pendingInteraction)
            ? pendingInteraction!
            : null,
      },
      ({ matched }) => (
        <div className="snow snow-save-composer">
          {planQuestion(matched) ? (
            <PlanQuestionCard key={matched!.key} pending={matched} />
          ) : (
            <SaveCard
              key={matched!.key}
              item={{ callId: saveQuestion(matched)?.callId }}
              pending={matched}
            />
          )}
        </div>
      ),
    ),
  );
}
