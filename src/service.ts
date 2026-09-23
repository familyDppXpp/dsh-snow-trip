import type { Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

declare module '@deepseek-ai/cordis' {
  interface Context { snowTrip: SnowTrip }
}

/** 雪季工作台宿主入口；套餐数据在 SNOW-02 接入。 */
export class SnowTrip extends TypertRemoteService {
  constructor(ctx: Context) { super(ctx, 'snowTrip'); }

  @Remote('listPackages')
  listPackages(): [] { return []; }

  @Remote('ensureWorkspace')
  async ensureWorkspace(): Promise<string> {
    const path = join(homedir(), 'dsh-snow-trip');
    await mkdir(path, { recursive: true });
    return path;
  }
}
