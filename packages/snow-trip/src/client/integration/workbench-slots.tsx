import type { SessionId } from '@deepseek-ai/dsh-session/types';
import { DepartureHero } from '../conversation/departure.tsx';
import { questionAnswerDefinition } from '../conversation/projections.ts';
import { QuestionAnswerCard } from '../conversation/question-answer.tsx';
import { recordReferenceSource } from '../conversation/references.ts';
import { mirrorQuestions } from '../conversation/sessions.ts';
import type { Actions, Context } from '../integration/types.ts';
import { SavedPackageCard } from '../packages/card.tsx';
import { PackageSidebarToggle } from '../packages/sidebar.tsx';

import { registerConversationCards } from './slots.tsx';

export function registerWorkbenchSlots(
  view: Context,
  ctx: Context,
  selection: Actions['selection'],
) {
  const scopeFor = (id?: string) => {
    const scope = id ? view.sessions.scope(id as SessionId) : undefined;
    if (!scope) throw new Error('会话尚未就绪，请重试。');
    return scope;
  };
  view.slots.inject('conversation.hero.brand.mark', () =>
    view.slots.register(
      {
        name: 'conversation.hero.brand.mark',
        inject: () => ({
          selection,
          inputFor: (id?: string) => view.conversation.input.for(scopeFor(id)),
          chooseSkill: (id: string | undefined, skill: string) => {
            const scope = scopeFor(id),
              input = view.conversation.input.for(scope),
              state = input.state.getSnapshot();
            if (state.phase !== 'plain')
              throw new Error('请先完成当前输入操作。');
            const leading =
              state.draft.match(/^\/(?:snow-import|snow-plan)(?:\s+|$)/)?.[0] ??
              '';
            if (
              !scope.bail('slash/input-insert-text', {
                text: `/${skill} `,
                span: {
                  start: 0,
                  end: leading.length,
                  draftRev: state.draftRev,
                },
              })
            )
              throw new Error('选择技能失败，请重试。');
          },
        }),
      },
      DepartureHero,
    ),
  );
  registerConversationCards(view, 'snow-stopped-workbench');
  view.uiConversation.events.register(questionAnswerDefinition);
  view.slots.inject('conversation.chat.node', () =>
    view.slots.register(
      { name: 'conversation.chat.node', key: 'snow-question-answer' },
      ({ node }) => <QuestionAnswerCard data={node.data} />,
    ),
  );
  view.slots.inject('conversation.chat.node', () =>
    view.slots.register(
      { name: 'conversation.chat.node', key: 'system-prompt', priority: -1 },
      () => null,
    ),
  );
  view.slots.inject('conversation.chat.node', () =>
    view.slots.register(
      { name: 'conversation.chat.node', key: 'turn-process', priority: -1 },
      ({ node, turnProcess }) =>
        'turn' in node.location && node.location.turn.status === 'open' ? (
          <div className="snow-running" role="status">
            <span aria-hidden="true" />
            正在处理…
          </div>
        ) : turnProcess?.foldable && turnProcess.hasContent ? (
          <button
            type="button"
            className="snow-process-toggle"
            data-turn-process=""
            aria-expanded={turnProcess.open}
            onClick={() => turnProcess.setOpen(!turnProcess.open)}
          >
            {turnProcess.open ? '收起执行过程' : '查看执行过程'}
          </button>
        ) : null,
    ),
  );

  view.effect(() =>
    mirrorQuestions(ctx.uiSession.sessionStatus, view.uiSession),
  );
  view.slots.inject('tool.call.toolview', () =>
    view.slots.register(
      { name: 'tool.call.toolview', key: 'snow_save_packages' },
      SavedPackageCard,
    ),
  );
  view.slots.inject('conversation.session.header.utilities', () =>
    view.slots.register(
      {
        name: 'conversation.session.header.utilities',
        id: 'snow-package-sidebar',
      },
      PackageSidebarToggle,
    ),
  );
  view.effect(() =>
    view.inputTriggers.registerSource(
      recordReferenceSource(view.remote.snowTrip, (id) => {
        const scope = view.sessions.scope(id as SessionId);
        return scope ? view.conversation.input.for(scope) : null;
      }),
    ),
  );
}
