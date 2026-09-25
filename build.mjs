import { build } from 'esbuild';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { WorkspaceTypertGenerator } from '@deepseek-ai/dsh-typert-generator';

execFileSync(process.execPath, ['node_modules/typescript/bin/tsc'], { stdio: 'inherit' });
await build({entryPoints:['lib/types/service.js'],outfile:'lib/service.js',bundle:true,format:'esm',platform:'node',packages:'external'});
await build({entryPoints:['lib/types/tools.js'],outfile:'lib/tools.js',bundle:true,format:'esm',platform:'node',packages:'external'});
// 当前 SDK 仅分析 packages/ 下的项目；临时装配本包，不依赖宿主源码树。
const stage = await mkdtemp(join(tmpdir(), 'snow-typert-'));
try {
  const pkg = join(stage, 'packages/snow-trip');
  await mkdir(pkg, { recursive: true });
  await symlink(resolve('node_modules'), join(stage, 'node_modules'), 'dir');
  for (const path of ['package.json', 'tsconfig.json', 'src', 'lib/types']) {
    await cp(path, join(pkg, path), { recursive: true });
  }
  const manifest = JSON.parse(await readFile('package.json', 'utf8'));
  delete manifest.exports['./tools'];
  await writeFile(join(pkg, 'package.json'), JSON.stringify(manifest));
  // SDK 按项目身份识别装饰器；把已安装的公开声明也纳入临时项目图。
  await cp('node_modules/@deepseek-ai/dsh-typert-protocol', join(stage, 'packages/protocol'), {recursive:true,dereference:true});
  await mkdir(join(stage, 'packages/protocol/src'));
  for (const file of await readdir('node_modules/@deepseek-ai/dsh-typert-protocol/lib/types')) {
    if (file.endsWith('.d.ts')) await cp(`node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/${file}`, join(stage, 'packages/protocol/src', file.replace('.d.ts','.ts')));
  }
  await writeFile(join(stage, 'packages/protocol/tsconfig.json'), JSON.stringify({compilerOptions:{skipLibCheck:true},include:['src/**/*.ts']}));
  const config = JSON.parse(await readFile('tsconfig.json', 'utf8'));
  config.compilerOptions.paths = {'@deepseek-ai/dsh-typert-protocol':['../protocol/src/index.ts']};
  await writeFile(join(pkg, 'tsconfig.json'), JSON.stringify(config));
  await writeFile(join(stage, 'tsconfig.host.json'), JSON.stringify({
    compilerOptions:{...config.compilerOptions,paths:{'@deepseek-ai/dsh-typert-protocol':['./packages/protocol/src/index.ts']}},
    files:[],references:[{path:'./packages/snow-trip'},{path:'./packages/protocol'}],
  }));
  const [artifact] = new WorkspaceTypertGenerator(stage).generate(['dsh-snow-trip'], ['host']);
  if (!artifact?.remote) throw new Error('未生成雪季 Remote 描述');
  for (const [path, content] of Object.entries({
    'typert.host.js':artifact.js, 'typert.host.d.ts':artifact.dts,
    'typert.remote-client.js':artifact.remote.js, 'typert.remote-client.d.ts':artifact.remote.dts,
  })) await writeFile(join('lib', path), content);
} finally { await rm(stage, { recursive: true, force: true }); }

await build({
  entryPoints: ['src/client.jsx'], outfile: 'lib/client.js', bundle: true,
  format: 'cjs', platform: 'browser', target: ['es2022'], jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'], loader: { '.css': 'text' }, minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  banner: { js: 'window.__ModuleLoader__.load({id:"dsh-snow-trip",factory:(require)=>{const module={exports:{}};const exports=module.exports;' },
  footer: { js: 'return module.exports;}});' },
});
