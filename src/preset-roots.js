import { fileURLToPath } from 'node:url';

export const inject = ['loader', 'sessionProjections'];

// bundle 保留原条目的全部配置，仅用此装配器追加本包预设目录。
export async function apply(ctx) {
  const original = [...ctx.loader.entries()].find(entry => entry.options.id === 'agent-presets');
  if (!original) throw new Error('雪季预设需要 DSH Web profile 的 agent-presets 配置');
  const { interpolate } = await ctx.loader.import('@deepseek-ai/cordis-plugin-loader');
  const config = interpolate(ctx, original.options.config);
  const plugin = ctx.loader.unwrapExports(await ctx.loader.import('@deepseek-ai/dsh-agent-presets'));
  await ctx.plugin(plugin, {
    ...config,
    roots: [...(config.roots || []), { path: fileURLToPath(new URL('../presets/', import.meta.url)), trust: 'system' }],
  });
}
