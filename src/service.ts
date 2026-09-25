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
import {planningRecord,resultRecord,type Planning,type Calculation} from './planning.js';

declare module '@deepseek-ai/cordis' { interface Context { snowTrip: SnowTrip } }
export const snowDomain=defineDomain({name:'snow_trip',version:1,tables:{packages:domainTable(packageRecord),plans:domainTable(planRecord),planning:domainTable(planningRecord),calculations:domainTable(resultRecord)}});
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
      const calculation=this.domain.table('calculations').get(value.id);
      if(calculation&&this.domain.table('planning').get(calculation.planningId)?.supersededBy)throw new Error('出行条件已变化，旧结果不能保存为当前方案');
      const packages=this.domain.table('packages');
      for(const entry of value.packages){
        const current=packages.get(entry.id);
        if(!current||current.revision!==entry.revision)throw new Error(`套餐 ${entry.snapshot.name} 已变更，方案未保存，请重新计算`);
      }
      await this.domain.table('plans').put(value.id,value);
    });
  }
  async createPlanning(value:Planning):Promise<void> {
    await this.ready;return this.write(async()=>{
      const p=planningRecord.parse(value),table=this.domain.table('planning');
      for(const [id,old] of table.entries())if(old.sessionId===p.sessionId&&!old.supersededBy)await table.put(id,{...old,supersededBy:p.id});
      await table.put(p.id,p);
    });
  }
  async currentPlanning(sessionId:string):Promise<Planning|null>{await this.ready;return structuredClone([...this.domain.table('planning').entries()].map(([,p])=>p).find(p=>p.sessionId===sessionId&&!p.supersededBy)??null);}
  async getPlanning(id:string):Promise<Planning|null>{await this.ready;return structuredClone(this.domain.table('planning').get(id)??null);}
  async setPlanningStatus(id:string,status:Planning['status']):Promise<void>{await this.ready;return this.write(async()=>{await this.domain.table('planning').update(id,p=>({...p,status}));});}
  async putCalculation(value:Calculation):Promise<void>{await this.ready;return this.write(async()=>{
    const p=this.domain.table('planning').get(value.planningId);
    if(!p||p.supersededBy)throw new Error('出行条件已变化，请使用新规划重新核算');
    for(const entry of value.plan.packages)if(this.domain.table('packages').get(entry.id)?.revision!==entry.revision)throw new Error('套餐版本已变化，请重新核算');
    await this.domain.table('calculations').put(value.id,resultRecord.parse(value));
  });}
  async getCalculation(id:string):Promise<Calculation|null>{await this.ready;return structuredClone(this.domain.table('calculations').get(id)??null);}
  async listCalculations(planningId:string):Promise<Calculation[]>{await this.ready;return [...this.domain.table('calculations').entries()].map(([,v])=>structuredClone(v)).filter(v=>v.planningId===planningId);}
  @Remote('listPlans')
  async listPlans(): Promise<PlanRecord[]> {
    await this.ready;
    return [...this.domain.table('plans').entries()].map(([,p])=>structuredClone(p));
  }
  @Remote('deletePlan')
  async deletePlan(id: string): Promise<{sessionId:string|null;archiveError:string|null}> {
    await this.ready;
    return this.write(async()=>{
      const key=z.uuid().parse(id),table=this.domain.table('plans'),record=table.get(key);
      if(!record)return {sessionId:null,archiveError:null};
      const last=![...table.entries()].some(([other,p])=>other!==key&&p.sessionId===record.sessionId)&&![...this.domain.table('packages').entries()].some(([,p])=>p.sessionId===record.sessionId);
      await table.delete(key);
      if(last){
        try{await this.ctx.workspaceRegistry.archiveSession(record.sessionId as Parameters<WorkspaceRegistry['archiveSession']>[0]);}
        catch(error){return {sessionId:null,archiveError:error instanceof Error?error.message:String(error)};}
      }
      return {sessionId:last?record.sessionId:null,archiveError:null};
    });
  }
  @Remote('getPlan')
  async getPlan(id: string): Promise<PlanRecord|null> {
    await this.ready;
    return structuredClone(this.domain.table('plans').get(z.uuid().parse(id))??null);
  }
  @Remote('deletePackage')
  async deletePackage(id: string, revision: number, archiveSession: boolean, confirmedPlanIds?: string[]): Promise<{sessionId:string|null;archiveError:string|null}> {
    await this.ready;
    return this.write(async()=>{
      const key=z.uuid().parse(id);
      z.number().int().min(1).parse(revision);z.boolean().parse(archiveSession);
      const confirmed=z.array(z.uuid()).parse(confirmedPlanIds??[]);
      const table=this.domain.table('packages'),plans=this.domain.table('plans');
      const record=table.get(key);
      if(!record||record.revision!==revision)throw new Error('套餐已变更，请刷新后重新确认');
      const affected=[...plans.entries()].map(([,p])=>p).filter(p=>p.packages.some(entry=>entry.id===key));
      if(confirmed.length!==affected.length||new Set(confirmed).size!==confirmed.length||affected.some(p=>!confirmed.includes(p.id)))throw new Error('受影响的方案已变更，请关闭确认框并重新删除，核对方案列表。');
      const affectedIds=new Set(confirmed);
      const last=![...table.entries()].some(([other,p])=>other!==key&&p.sessionId===record.sessionId)&&![...plans.entries()].some(([planId,p])=>!affectedIds.has(planId)&&p.sessionId===record.sessionId);
      if(last!==archiveSession)throw new Error('关联套餐已变更，请刷新后重新确认');
      // 存储没有跨记录事务：先删方案，最后删套餐，失败时保留套餐以便重新确认重试。
      let deleted=0;
      try{
        for(const plan of affected){await plans.delete(plan.id);deleted++;}
        await table.delete(key);
      }catch(error){throw new Error(`删除未完成（已删除 ${deleted} 份关联方案），请刷新后重新核对：${error instanceof Error?error.message:String(error)}`);}
      const errors:string[]=[];let sessionId:string|null=null;
      for(const candidate of new Set([record.sessionId,...affected.map(p=>p.sessionId)])){
        if([...table.entries()].some(([,p])=>p.sessionId===candidate)||[...plans.entries()].some(([,p])=>p.sessionId===candidate))continue;
        try{await this.ctx.workspaceRegistry.archiveSession(candidate as Parameters<WorkspaceRegistry['archiveSession']>[0]);if(candidate===record.sessionId)sessionId=candidate;}
        catch(error){errors.push(error instanceof Error?error.message:String(error));}
      }
      return {sessionId,archiveError:errors.length?errors.join('；'):null};
    });
  }
  @Remote('archiveSession')
  async archiveSession(id: string): Promise<void> {
    await this.ready;
    return this.write(async()=>{
      const sessionId=z.string().trim().min(1).parse(id);
      if([...this.domain.table('packages').entries()].some(([,record])=>record.sessionId===sessionId))throw new Error('该会话有关联套餐，请在出行方案的套餐卡片中删除。');
      if([...this.domain.table('plans').entries()].some(([,record])=>record.sessionId===sessionId))throw new Error('该会话有关联方案，请在已存方案页面删除。');
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
