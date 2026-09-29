import type { ConversationNodeDefinition } from '@deepseek-ai/dsh-client-ui-conversation/client';
import { normalizePackage, saveMetadata } from '../../shared/packages.ts';
import type {
  PlanMetadata,
  QuestionRecord,
  SaveItem,
  SaveTurnState,
} from './card-types.ts';
declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  interface ConversationTurnDataMap {
    snowSaves: SaveItem[];
  }
}
declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  interface ChatNodeDataMap {
    'snow-confirmed-plan': PlanMetadata;
    'snow-question-answer': QuestionRecord;
  }
}
const planMeta = (value: unknown): PlanMetadata | undefined =>
  value && typeof value === 'object' ? (value as PlanMetadata) : undefined;
// 每次提交独立投影，确认与结果共用 callId；宿主折叠工具过程时卡片仍可见。
// 只为套餐停止状态与旧快照恢复保留投影，后台核算不生成卡片。
export const saveTurnDefinition: ConversationNodeDefinition<SaveTurnState> = {
  kind: 'snowSaves',
  match: (event) =>
    event.type === 'turn/start'
      ? { id: String(event.data.turn), role: 'start' }
      : event.type === 'tool/call' ||
          (event.type === 'tool/result' && event.surfaceOp === 'append')
        ? { id: String(event.data.turn), role: 'update' }
        : null,
  start: (_context, { event }, reader) => {
    if (event.type !== 'turn/start') throw new Error('保存投影缺少轮次起点');
    const previous = reader?.previous('snowSaves')?.state as
      | SaveTurnState
      | undefined;
    return {
      turn: event.data.turn,
      items: [],
      drafts: previous?.drafts ?? {},
      records: previous?.records ?? {},
      calls: {},
    };
  },
  update: ({ state }, { event }) => {
    if (event.type === 'tool/call') {
      const callId = String(event.data.callId);
      if (event.data.name === 'snow_commit') {
        let draftId;
        try {
          draftId = JSON.parse(event.data.arguments).draftId;
        } catch {}
        const snapshot = state.drafts[draftId];
        return {
          ...state,
          items: [
            ...state.items,
            { callId, ...(snapshot ? { snapshot } : {}) },
          ],
        };
      }

      return event.data.name.startsWith('snow_')
        ? { ...state, calls: { ...state.calls, [callId]: true } }
        : state;
    }
    if (event.type !== 'tool/result') return state;
    const callId = String(event.data.message.source.callId);
    const result = event.data.message;
    const pending = state.items.find((item) => item.callId === callId);
    if (pending && pending.kind)
      return {
        ...state,
        items: state.items.map((item) =>
          item.callId === callId
            ? {
                ...item,
                done: true,
                meta: event.data.meta,
                error: result.isError
                  ? result.content
                      ?.filter((c) => c.type === 'text')
                      .map((c) => c.text)
                      .join('\n') || '执行失败，请调整后重试。'
                  : null,
              }
            : item,
        ),
      };
    if (!state.items.some((item) => item.callId === callId)) {
      if (state.calls[callId] && !result.isError) {
        try {
          const draft = JSON.parse(
            result.content
              ?.filter((c) => c.type === 'text')
              .map((c) => c.text)
              .join('') ?? '',
          );
          if (
            draft.status === 'draft' &&
            draft.draftId &&
            draft.amountUnit === '元' &&
            draft.package
          ) {
            const data = { ...draft.package };
            for (const key of ['quote', 'paid', 'paidExtra'])
              if (typeof data[key] === 'number')
                data[key] = Math.round(data[key] * 100);
            const previous = draft.id
              ? state.records[draft.id + ':' + draft.expectedRevision]
              : null;
            // 缺少修改前的历史版本时，不把修改卡片降级为完整套餐详情。
            if (draft.id && !previous) return state;
            return {
              ...state,
              drafts: {
                ...state.drafts,
                [draft.draftId]: { previous, preview: normalizePackage(data) },
              },
            };
          }
        } catch {}
      }
      return state;
    }
    const saved = saveMetadata(event.data.meta)?.record;
    const records = saved
      ? { ...state.records, [saved.id + ':' + saved.revision]: saved }
      : state.records;
    const error = result.isError
      ? result.content
          ?.filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n') || '保存失败，请重新查询后调整。'
      : null;
    const stopped =
      error === 'Error: ask_user_question was aborted before the user answered';
    return {
      ...state,
      records,
      items: state.items.map((item) =>
        item.callId === callId
          ? {
              ...item,
              done: true,
              meta: event.data.meta,
              stopped,
              error: stopped ? null : error,
            }
          : item,
      ),
    };
  },
  buildLocationData: ({ state }, scope, previous) =>
    scope !== 'turn' || !state
      ? null
      : previous?.value === state.items
        ? previous
        : {
            kind: 'turn',
            turn: state.turn,
            key: 'snowSaves',
            value: state.items,
          },
};

// 交互完成即发布只读反馈，不依赖整轮结束；后台工具不匹配。
export const confirmedPlanDefinition: ConversationNodeDefinition<{
  seq: number;
  data: PlanMetadata | undefined;
}> = {
  kind: 'snow-confirmed-plan',
  target: 'chat',
  match: (event) =>
    event.type === 'tool/result' &&
    event.surfaceOp === 'append' &&
    ((planMeta(event.data.meta)?.status === 'prepared' &&
      !planMeta(event.data.meta)?.reused &&
      planMeta(event.data.meta)?.conditions) ||
      planMeta(event.data.meta)?.interaction ||
      planMeta(event.data.meta)?.status === 'save_results' ||
      (planMeta(event.data.meta)?.version === 1 &&
        planMeta(event.data.meta)?.status === 'saved' &&
        planMeta(event.data.meta)?.plan) ||
      (['saved', 'adjusting', 'cancelled'].includes(
        planMeta(event.data.meta)?.status ?? '',
      ) &&
        planMeta(event.data.meta)?.version === 2))
      ? { id: String(event.data.message.source.callId), role: 'start' }
      : null,
  start: (_context, { event }) => ({
    seq: event.seq,
    data: event.type === 'tool/result' ? planMeta(event.data.meta) : undefined,
  }),
  update: ({ state }) => state,
  // 业务交互记录独立于轮次处理过程，按原始事件序号保留位置。
  buildViewNode: (context) =>
    context.state
      ? {
          key: context.key,
          id: context.id,
          kind: 'snow-confirmed-plan',
          target: 'chat',
          anchorSeq: context.state.seq,
          location: { kind: 'session' },
          visibility: 'visible',
          data: context.state.data,
        }
      : null,
};

// 通用提问按 callId 配对题目与回答，完成后独立留在消息流。
export const questionAnswerDefinition: ConversationNodeDefinition<QuestionRecord> =
  {
    kind: 'snow-question-answer',
    target: 'chat',
    match: (event) =>
      event.type === 'tool/call' && event.data.name === 'ask_user_question'
        ? { id: String(event.data.callId), role: 'start' }
        : event.type === 'tool/result' && event.surfaceOp === 'append'
          ? { id: String(event.data.message.source.callId), role: 'update' }
          : null,
    start: (_context, { event }) => {
      try {
        return {
          questions:
            event.type === 'tool/call'
              ? JSON.parse(event.data.arguments).questions
              : [],
          seq: event.seq,
        };
      } catch {
        return { questions: [], seq: event.seq };
      }
    },
    update: ({ state }, { event }) => {
      if (!state || event.type !== 'tool/result') return state;
      const result = event.data.message;
      if (result.isError) return state;
      try {
        const value = JSON.parse(
          result.content
            ?.filter((c) => c.type === 'text')
            .map((c) => c.text)
            .join('') ?? '',
        );
        if (!Array.isArray(value.answers)) return state;
        return { ...state, seq: event.seq, answers: value.answers };
      } catch {
        return state;
      }
    },
    buildViewNode: (context) =>
      context.state?.answers
        ? {
            key: context.key,
            id: context.id,
            kind: 'snow-question-answer',
            target: 'chat',
            anchorSeq: context.state.seq,
            location: { kind: 'session' },
            visibility: 'visible',
            data: context.state,
          }
        : null,
  };
