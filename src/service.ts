import { Service, type Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { defineDomain, domainTable, type Domain } from '@deepseek-ai/dsh-storage-domain';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace';
import { packageRecord, type PackageRecord } from './packages.js';
import { planRecord, type PlanRecord } from './plans.js';

declare module '@deepseek-ai/cordis' { interface Context { snowTrip: SnowTrip } }
export const snowDomain=defineDomain({name:'snow_trip',version:1,tables:{packages:domainTable(packageRecord),plans:domainTable(planRecord)}});
export class SnowTrip extends TypertRemoteService {
  static inject=['storageDomain','workspaceRegistry'];
  private domain!: Domain<typeof snowDomain>;
  private ready: Promise<void>;
  // ponytail: 套餐写入共用队列；写入吞吐成为瓶颈时再按会话分队列。
  private writes: Promise<unknown>=Promise.resolve();
  private write<T>(operation:()=>Promise<T>): Promise<T> {
    const result=this.writes.then(operation);
    this.writes=result.catch(()=>{});
    return result;
  }
  constructor(ctx: Context) {
    super(ctx,'snowTrip');
    this.ready=ctx.storageDomain.open(snowDomain).then(domain=>{
      this.domain=domain;
      ctx.effect(()=>()=>domain.close());
    });
  }
  [Service.init](): Promise<void> { return this.ready; }
  // 仅供服务端工具调用，不暴露为 Remote 写入接口。
  async savePackage(record: PackageRecord, expectedRevision?: number): Promise<void> {
    await this.ready;
    return this.write(async()=>{
      const value=packageRecord.parse(record);
      const table=this.domain.table('packages');
      if(expectedRevision!==undefined) {
        await table.update(value.id,current=>{
          if(current.revision!==expectedRevision||value.revision!==expectedRevision+1)throw new Error('套餐已被更新，请重新查询并确认');
          return value;
        });
      } else {
        await table.put(value.id,value);
      }
    });
  }
  // 仅供服务端工具调用；保存前由工具核查套餐版本与资料完成状态。
  async savePlan(record: PlanRecord): Promise<void> {
    await this.ready;
    return this.write(async()=>{
      const value=planRecord.parse(record);
      const packages=this.domain.table('packages');
      for(const entry of value.packages){
        const current=packages.get(entry.id);
        if(!current||current.revision!==entry.revision)throw new Error(`套餐 ${entry.snapshot.name} 已变更，方案未保存，请重新计算`);
      }
      await this.domain.table('plans').put(value.id,value);
    });
  }
  @Remote('listPlans')
  async listPlans(): Promise<PlanRecord[]> {
    await this.ready;
    return [...this.domain.table('plans').entries()].map(([,p])=>structuredClone(p));
  }
  @Remote('getPlan')
  async getPlan(id: string): Promise<PlanRecord|null> {
    await this.ready;
    return structuredClone(this.domain.table('plans').get(z.uuid().parse(id))??null);
  }
  @Remote('deletePackage')
  async deletePackage(id: string, revision: number, archiveSession: boolean): Promise<{sessionId:string|null;archiveError:string|null}> {
    await this.ready;
    return this.write(async()=>{
      const key=z.uuid().parse(id);
      z.number().int().min(1).parse(revision);z.boolean().parse(archiveSession);
      const table=this.domain.table('packages');
      const record=table.get(key);
      if(!record||record.revision!==revision)throw new Error('套餐已变更，请刷新后重新确认');
      const last=![...table.entries()].some(([other,p])=>other!==key&&p.sessionId===record.sessionId);
      if(last!==archiveSession)throw new Error('关联套餐已变更，请刷新后重新确认');
      await table.delete(key);
      if(last) {
        try{await this.ctx.workspaceRegistry.archiveSession(record.sessionId as Parameters<WorkspaceRegistry['archiveSession']>[0]);}
        catch(error){return {sessionId:null,archiveError:error instanceof Error?error.message:String(error)};}
      }
      return {sessionId:last?record.sessionId:null,archiveError:null};
    });
  }
  @Remote('archiveSession')
  async archiveSession(id: string): Promise<void> {
    await this.ready;
    return this.write(async()=>{
      const sessionId=z.string().trim().min(1).parse(id);
      if([...this.domain.table('packages').entries()].some(([,record])=>record.sessionId===sessionId))throw new Error('该会话有关联套餐，请在出行方案的套餐卡片中删除。');
      await this.ctx.workspaceRegistry.archiveSession(sessionId as Parameters<WorkspaceRegistry['archiveSession']>[0]);
    });
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
