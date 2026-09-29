import calendarStyles from 'react-day-picker/style.css';
import remote from '../../lib/typert.remote-client.js';
import { registerConversationCards } from './integration/slots.tsx';
import type { Context } from './integration/types.ts';
import { createWorkbench } from './integration/workbench.tsx';
import { Entry } from './workbench/entry.tsx';
import styles from './workbench/style.css';

export const inject = [
  'slots',
  'modules',
  'sessions',
  'remote',
  'uiSession',
  'uiConversation',
];

export async function apply(ctx: Context) {
  ctx.effect(() => {
    const style = document.createElement('style');
    style.textContent = calendarStyles + '\n' + styles;
    document.head.append(style);
    return () => style.remove();
  });
  await ctx.remote.$mount(remote);
  const prepare = createWorkbench(ctx);
  registerConversationCards(ctx, 'snow-stopped-main');
  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'dsh-snow-trip',
        inject: () => ({ prepare }),
      },
      Entry,
    ),
  );
}
