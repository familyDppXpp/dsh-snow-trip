import type { Plugin } from '@deepseek-ai/cordis';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import { errorMessage } from '../../shared/errors.ts';
import type {
  Actions,
  Context,
  SessionReference,
} from '../integration/types.ts';
import { App } from '../workbench/app.tsx';
import { registerWorkbenchSlots } from './workbench-slots.tsx';

import type { Mount } from '../workbench/entry.tsx';
import { createWorkbenchActions, type WorkbenchLifecycle } from './actions.ts';
const uiPlugins = [
  'ui-renderer',
  'locale',
  'shortcuts',
  'ui-session',
  'ui-workspace',
  'ui-conversation',
  'ui-chat',
  'ui-attachment',
  'ui-tool',
  'ui-user-questions',
  'ui-input-trigger',
  'ui-commands',
  'ui-skill',
  'ui-model-selection',
];
export function createWorkbench(ctx: Context) {
  let ready: Promise<Mount> | undefined;
  const lifecycle: WorkbenchLifecycle = { close: () => {} };
  const prepare = (onClose: () => void) => {
    lifecycle.close = onClose;
    ready ??= assemble().catch((error) => {
      ready = undefined;
      throw error;
    });
    return ready;
  };
  async function assemble() {
    let mount: Mount | undefined;
    const fiber = ctx.plugin({
      name: 'snow-trip-workbench',
      async apply(scope: Context) {
        let local = scope;
        // 输入扩展在本工作台重新装配，避免继承主界面的命令和草稿状态。
        for (const key of [
          'slots',
          'uiRenderer',
          'uiSession',
          'uiConversation',
          'conversation',
          'locale',
          'uiWorkspace',
          'inputTriggers',
          'commandUi',
          'modelDirectories',
          'shortcuts',
        ])
          local = local.isolate(key);
        for (const key of uiPlugins) {
          const plugin = (await ctx.modules.import(
            `@deepseek-ai/dsh-client-${key}/client`,
            '',
            {},
          )) as Plugin.Function<unknown> | Plugin.Object<unknown>;
          if (key === 'ui-commands')
            await local.plugin({
              name: 'snow-trip-command-menu',
              inject: ['inputTriggers'],
              apply(menu: Context) {
                // 只过滤本工作台的菜单发现；宿主权限命令仍保留并拒绝切换。
                const triggers = menu.inputTriggers,
                  register = triggers.registerSource;
                triggers.registerSource = function (source) {
                  return register.call(
                    this,
                    source.name === 'command'
                      ? {
                          ...source,
                          candidates: async (...args) =>
                            (await source.candidates(...args)).filter(
                              (item) => item.name !== 'permission',
                            ),
                        }
                      : source,
                  );
                };
                menu.effect(() => () => {
                  triggers.registerSource = register;
                });
              },
            });
          try {
            await local.plugin(
              typeof plugin === 'function'
                ? plugin
                : {
                    name: `snow-trip-${key}`,
                    inject: plugin.inject,
                    Config: plugin.Config,
                    apply: plugin.apply,
                  },
            );
          } catch (error) {
            throw new Error(`加载 ${key} 失败：${errorMessage(error)}`, {
              cause: error,
            });
          }
        }
        await local.plugin({
          name: 'snow-trip-session-entry',
          inject: [
            'uiConversation',
            'slots',
            'uiRenderer',
            'uiSession',
            'sessions',
            'workspaces',
            'conversation',
            'inputTriggers',
            'remote',
            'remote.agentPresets',
            'remote.snowTrip',
          ],
          apply(view: Context) {
            const selectionListeners = new Set<() => void>();
            let reference: SessionReference | undefined;
            const select = (id: string) => {
              if (reference?.sessionId === id) return;
              const previous = reference;
              reference = view.sessions.retain(id as SessionId, {
                source: 'snowTrip',
              });
              previous?.release();
              for (const listener of selectionListeners) listener();
            };
            view.effect(() => () => reference?.release());
            const selection = {
              getSnapshot: () => reference,
              subscribe: (listener: () => void) => {
                selectionListeners.add(listener);
                return () => selectionListeners.delete(listener);
              },
            };

            registerWorkbenchSlots(view, ctx, selection);
            const actions = createWorkbenchActions(
              view,
              selection,
              select,
              lifecycle,
            );
            // 工作台隔离了 slots；它的 main 带会话作用域，与宿主同名 root 插槽不同。
            const registerWorkbenchRoot = view.slots.register.bind(
              view.slots,
            ) as (
              options: {
                name: 'root';
                children: { main: { kind: 'keyed'; scope: 'session-maybe' } };
                inject: () => { actions: Actions };
              },
              component: typeof App,
            ) => () => void;
            registerWorkbenchRoot(
              {
                name: 'root',
                children: { main: { kind: 'keyed', scope: 'session-maybe' } },
                inject: () => ({ actions }),
              },
              App,
            );
            mount = (container) => {
              if (lifecycle.lastSession) {
                try {
                  actions.open(lifecycle.lastSession);
                } catch {
                  lifecycle.lastSession = undefined;
                }
              }
              return view.uiRenderer.mount(container);
            };
          },
        });
      },
    });
    try {
      await fiber;
      if (!mount) throw new Error('工作台未完成装配');
      return mount;
    } catch (error) {
      await fiber.dispose();
      throw error;
    }
  }

  return prepare;
}
