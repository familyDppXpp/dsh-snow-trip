import { Service, type Context } from '@deepseek-ai/cordis';
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import { defineTool, type ParameterSchemaSpec } from '@deepseek-ai/dsh-tools';
import { defineDomain, domainTable, type Domain } from '@deepseek-ai/dsh-storage-domain';
import { BUNDLED_SKILL_RANK } from '@deepseek-ai/dsh-skill';
import '@deepseek-ai/dsh-user-questions';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { normalizePackage, packageRecord, packageSummary, fieldLabels, type PackageRecord } from './packages.js';

declare module '@deepseek-ai/cordis' { interface Context { snowTrip: SnowTrip } }
export const snowDomain=defineDomain({name:'snow_trip',version:1,tables:{packages:domainTable(packageRecord)}});
// 同一份公开输入字段供模型发现；业务边界仍由 Zod 严格校验。
const properties: ParameterSchemaSpec=Object.fromEntries(Object.entries(fieldLabels).map(([key,label])=>[key,{type:'json',description:label+'；未知为 null'}]));
Object.assign(properties,{
  purchaseStatus:{type:'string',enum:['unknown','unpurchased','purchased']},
  sources:{type:'array',description:'可选：snow_query 返回的当前会话消息序号、原文与 nature（fact/user-supplement/inference）'},
  pendingQuestions:{type:'array',items:{type:'string'},description:'需要用户澄清的问题'},
});
const queryInput=z.strictObject({id:z.uuid().optional(),query:z.string().trim().max(200).optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(20)});

export class SnowTrip extends TypertRemoteService {
  static inject=['storageDomain','tools','skills','userQuestions'];
  private domain!: Domain<typeof snowDomain>;
  private ready: Promise<void>;
  constructor(ctx: Context) {
    super(ctx,'snowTrip');
    this.ready=ctx.storageDomain.open(snowDomain).then(domain=>{
      this.domain=domain;
      ctx.effect(()=>()=>domain.close());
    });
    const candidate={locator:'snow-import',name:'snow-import',description:'在同一会话整理文字套餐，追问未知项，经用户确认后保存。',invocation:{modelInvocable:true,userInvocable:true},provider:'snow-trip',source:'bundled',rank:BUNDLED_SKILL_RANK,resourceBase:{kind:'directory' as const,path:fileURLToPath(new URL('../skills/',import.meta.url))}};
    ctx.skills.registerProvider(()=>({name:'snow-trip',list:async()=>[candidate],get:async()=>({...candidate,content:await readFile(new URL('../skills/snow-import.md',import.meta.url),'utf8')})}));
    ctx.tools.register(defineTool({
      name:'snow_query',description:'查询宿主套餐与消息来源。金额单位为分，null 为未知。返回 total、truncated、nextOffset；messages 是当前会话最近的文字消息。',
      parameters:{id:{type:'string'},query:{type:'string'},offset:{type:'integer'},limit:{type:'integer'}},
      output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
      execute:async(args,exec)=>{
        const {id,query,offset,limit}=queryInput.parse(args);
        const all=(await this.listPackages()).filter(p=>(!id||p.id===id)&&(!query||[p.name,p.description,...(p.hotels??[])].join(' ').includes(query)));
        const rows=all.slice(offset,offset+limit);
        return {packages:rows,total:all.length,truncated:offset+rows.length<all.length,nextOffset:offset+rows.length<all.length?offset+rows.length:null,...this.messages(exec.agent)};
      },
    }));
    ctx.tools.register(defineTool({
      name:'snow_save_packages',description:'单条新增套餐。至少一项套餐信息；金额为非负整数分，日期 YYYY-MM-DD，hotels/surchargeRules/unavailableDates 为数组或 null。工具展示实际保存摘要并等待用户确认；任何 confirmed 字段无效。',
      parameters:{package:{type:'object',additionalProperties:false,properties,required:true}},
      output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}],presentationMeta:(_args,value)=>({version:1,record:value})},
      execute:async(args,exec)=>{
        await this.ready;
        exec.signal.throwIfAborted();
        if(!exec.agent)throw new Error('保存需要当前会话');
        if(Object.keys(args).some(key=>key!=='package'))throw new Error('不接受额外确认或授权字段');
        const p=normalizePackage(args.package);
        const {messages}=this.messages(exec.agent);
        const sources=p.sources??messages.map(m=>({...m,nature:'fact' as const}));
        if(!sources.length)throw new Error('缺少可定位的用户文字来源');
        for(const source of sources)if(!messages.some(m=>m.messageSeq===source.messageSeq&&m.text.includes(source.text)))throw new Error('来源必须引用当前会话的用户消息原文');
        const draft={...p,sources};
        // 确认与写入共享局部快照，不接受模型授权，也不跨调用缓存确认。
        const answer=await ctx.userQuestions.ask({agent:exec.agent,signal:exec.signal,questions:[{
          id:'save-package',header:'确认新增套餐',question:'确认保存以下套餐？',detail:packageSummary(draft).split('\n').map(line=>'    '+line).join('\n'),
          options:[{label:'确认保存'},{label:'暂不保存'}],
        }]});
        exec.signal.throwIfAborted();
        if(answer.answers.length!==1||answer.answers[0]?.id!=='save-package'||answer.answers[0].selected.length!==1||answer.answers[0].selected[0]!=='确认保存'||answer.answers[0].custom?.trim())throw new Error('未确认当前摘要，套餐未保存');
        const now=new Date().toISOString();
        const record=packageRecord.parse({...draft,id:randomUUID(),revision:1,schemaVersion:1,createdAt:now,updatedAt:now,sessionId:exec.agent.id,sources:sources.map(s=>({...s,sessionId:exec.agent!.id}))});
        await this.domain.table('packages').put(record.id,record);
        return record;
      },
    }));
  }
  [Service.init](): Promise<void> { return this.ready; }
  private messages(agent?: {session:{snapshotEvents(): readonly unknown[]}}) {
    const events=z.array(z.object({type:z.string(),seq:z.number(),data:z.unknown()})).parse(agent?.session.snapshotEvents()??[]);
    const messages=events.filter(e=>e.type==='user/message').flatMap(e=>{
      const parsed=z.object({source:z.object({kind:z.literal('user')}),content:z.array(z.object({type:z.string(),text:z.string().optional()}))}).safeParse(e.data);
      const text=parsed.success?parsed.data.content.filter(c=>c.type==='text').map(c=>c.text??'').join('\n').trim():'';
      return text?[{messageSeq:e.seq,text}]:[];
    });
    return {messages:messages.slice(-30).map(m=>({...m,text:m.text.slice(0,4000)})),messagesTruncated:messages.length>30||messages.some(m=>m.text.length>4000)};
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
