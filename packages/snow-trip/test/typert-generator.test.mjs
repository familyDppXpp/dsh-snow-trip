import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {WorkspaceTypertGenerator} from '@deepseek-ai/dsh-typert-generator';
import {typertPlugin} from '@deepseek-ai/dsh-typert-generator/tsdown';

test('两个生成入口识别已安装的协议包，拒绝其他包的同名 Remote',async()=>{
  const root=await mkdtemp(join(tmpdir(),'snow-typert-test-'));
  const pkg=join(root,'packages/probe');
  try {
    await mkdir(join(pkg,'src'),{recursive:true});
    await mkdir(join(root,'node_modules'));
    await symlink(resolve('node_modules/@deepseek-ai'),join(root,'node_modules/@deepseek-ai'),'dir');
    await writeFile(join(root,'tsconfig.host.json'),JSON.stringify({files:[],references:[{path:'./packages/probe'}]}));
    await writeFile(join(pkg,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',strict:true,skipLibCheck:true},include:['src']}));
    await writeFile(join(pkg,'package.json'),JSON.stringify({
      name:'snow-typert-probe',type:'module',
      exports:{'.':'./src/index.ts','./typert':{types:'./lib/typert.host.d.ts',default:'./lib/typert.host.js'},'./remote':{types:'./lib/typert.remote-client.d.ts',default:'./lib/typert.remote-client.js'}},
      files:['lib/typert.host.js','lib/typert.host.d.ts','lib/typert.remote-client.js','lib/typert.remote-client.d.ts'],
    }));
    const source=`import type {Context} from '@deepseek-ai/cordis';
import {Remote,TypertRemoteService} from '@deepseek-ai/dsh-typert-protocol';
export class Probe extends TypertRemoteService {
  constructor(ctx:Context){super(ctx,'probe');}
  @Remote echo(value:string):string{return value;}
}`;
    await writeFile(join(pkg,'src/index.ts'),source);
    const [artifact]=new WorkspaceTypertGenerator(root).generate(['snow-typert-probe'],['host']);
    assert.ok(artifact?.remote);
    assert.match(artifact.remote.dts,/probe\/echo/);
    // tsdown 子入口使用未打包的 analyzer.js，必须与主入口一起应用补丁。
    typertPlugin({faces:['host']}).writeBundle({dir:join(pkg,'lib')});
    assert.equal(await readFile(join(pkg,'lib/typert.remote-client.js'),'utf8'),artifact.remote.js);

    const lookalike=join(root,'node_modules/lookalike');
    await mkdir(lookalike);
    await writeFile(join(lookalike,'package.json'),JSON.stringify({name:'lookalike',type:'module',types:'index.d.ts'}));
    await writeFile(join(lookalike,'index.d.ts'),`export declare class TypertRemoteService { constructor(ctx:unknown,key:string); }
export declare function Remote(value:unknown,context:ClassMethodDecoratorContext):void;`);
    await writeFile(join(pkg,'src/index.ts'),source.replace('@deepseek-ai/dsh-typert-protocol','lookalike'));
    assert.deepEqual(new WorkspaceTypertGenerator(root).generate(undefined,['host']),[]);
  } finally {await rm(root,{recursive:true,force:true});}
});
