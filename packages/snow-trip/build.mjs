import { build } from 'esbuild';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { WorkspaceTypertGenerator } from '@deepseek-ai/dsh-typert-generator';

const workspace = fileURLToPath(new URL('../../', import.meta.url));
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
await rm('lib', { recursive: true, force: true });
execFileSync(process.execPath, [fileURLToPath(import.meta.resolve('typescript/bin/tsc')), '-p', 'tsconfig.json'], { stdio: 'inherit' });
const [artifact] = new WorkspaceTypertGenerator(workspace).generate([manifest.name], ['host']);
if (!artifact?.remote) throw new Error(`${manifest.name} 未生成 Remote 描述`);
for (const [path, content] of Object.entries({
  'typert.host.js': artifact.js, 'typert.host.d.ts': artifact.dts,
  'typert.remote-client.js': artifact.remote.js, 'typert.remote-client.d.ts': artifact.remote.dts,
})) await writeFile(join('lib', path), content);

await build({
  entryPoints: ['src/client/client.jsx'], outfile: 'lib/client.js', bundle: true,
  format: 'cjs', platform: 'browser', target: ['es2022'], jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'], loader: { '.css': 'text' }, minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: `window.__ModuleLoader__.load({id:${JSON.stringify(manifest.name)},factory:(require)=>{const module={exports:{}};const exports=module.exports;` },
  footer: { js: 'return module.exports;}});' },
});
