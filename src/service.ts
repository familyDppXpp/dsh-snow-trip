import { Service, type Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { defineDomain, domainTable, type Domain } from '@deepseek-ai/dsh-storage-domain';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { packageRecord, type PackageRecord } from './packages.js';

declare module '@deepseek-ai/cordis' { interface Context { snowTrip: SnowTrip } }
export const snowDomain=defineDomain({name:'snow_trip',version:1,tables:{packages:domainTable(packageRecord)}});
export class SnowTrip extends TypertRemoteService {
  static inject=['storageDomain'];
  private domain!: Domain<typeof snowDomain>;
  private ready: Promise<void>;
  constructor(ctx: Context) {
    super(ctx,'snowTrip');
    this.ready=ctx.storageDomain.open(snowDomain).then(domain=>{
      this.domain=domain;
      ctx.effect(()=>()=>domain.close());
    });
  }
  [Service.init](): Promise<void> { return this.ready; }
  // 仅供服务端工具调用，不暴露为 Remote 写入接口。
  async savePackage(record: PackageRecord): Promise<void> {
    await this.ready;
    const value=packageRecord.parse(record);
    await this.domain.table('packages').put(value.id,value);
  }
  @Remote('listPackages')
  async listPackages(): Promise<PackageRecord[]> {
    await this.ready;
    return [...this.domain.table('packages').entries()].map(([,p])=>structuredClone(p));
  }
  @Remote('getPackage')
  async getPackage(id: string): Promise<PackageRecord|null> {
    await this.ready;
    return structuredClone(this.domain.table('packages').get(z.uuid().parse(id))??null);
  }
  @Remote('ensureWorkspace')
  async ensureWorkspace(): Promise<string> {
    const path=join(homedir(),'dsh-snow-trip');
    await mkdir(path,{recursive:true});
    return path;
  }
}
