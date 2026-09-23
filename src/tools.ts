import type { Context } from '@deepseek-ai/cordis';
import { defineTool, type ParameterSchemaSpec } from '@deepseek-ai/dsh-tools';
import '@deepseek-ai/dsh-user-questions';
import type {} from './service.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { normalizePackage, packageRecord, packageSummary, fieldLabels } from './packages.js';

export const name='snow-trip-tools';
export const inject=['snowTrip','tools','userQuestions'];
// 同一份公开输入字段供模型发现；业务边界仍由 Zod 严格校验。
const properties: ParameterSchemaSpec=Object.fromEntries(Object.entries(fieldLabels).map(([key,label])=>[key,{type:'json',description:label+'；未知为 null'}]));
Object.assign(properties,{
  purchaseStatus:{type:'string',enum:['unknown','unpurchased','purchased']},
  pendingQuestions:{type:'array',items:{type:'string'},description:'需要用户澄清的问题'},
});
const saveInput=z.strictObject({id:z.uuid().optional(),expectedRevision:z.number().int().min(1).optional(),package:z.record(z.string(),z.unknown())}).refine(v=>(v.id===undefined)===(v.expectedRevision===undefined),'更新时必须同时提供 id 和 expectedRevision');
const queryInput=z.strictObject({id:z.uuid().optional(),query:z.string().trim().max(200).optional(),offset:z.number().int().min(0).default(0),limit:z.number().int().min(1).max(50).default(20)});

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name:'snow_query',description:'查询宿主套餐。金额单位为分，null 为未知。返回 total、truncated、nextOffset。',
    parameters:{id:{type:'string'},query:{type:'string'},offset:{type:'integer'},limit:{type:'integer'}},
    output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]},
    execute:async(args)=>{
      const {id,query,offset,limit}=queryInput.parse(args);
      const all=(await ctx.snowTrip.listPackages()).filter(p=>(!id||p.id===id)&&(!query||[p.name,p.description,...(p.hotels??[])].join(' ').includes(query)));
      const rows=all.slice(offset,offset+limit);
      return {packages:rows,total:all.length,truncated:offset+rows.length<all.length,nextOffset:offset+rows.length<all.length?offset+rows.length:null};
    },
  }));
  ctx.tools.register(defineTool({
    name:'snow_save_packages',description:'单条新增或补全套餐。更新必须提供 id 和查询得到的 expectedRevision，package 只传本次补充字段，未传字段保留。至少一项套餐信息；金额为非负整数分，日期 YYYY-MM-DD，hotels/surchargeRules/unavailableDates 为数组或 null。工具展示实际保存摘要并等待用户确认；任何 confirmed 字段无效。',
    parameters:{id:{type:'string',description:'更新已有套餐的 ID；新增不传'},expectedRevision:{type:'integer',description:'更新前 snow_query 返回的版本；新增不传'},package:{type:'object',additionalProperties:false,properties,required:true}},
    output:{schema:{type:'json'},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}],presentationMeta:(_args,value)=>({version:1,record:value})},
    execute:async(args,exec)=>{
      exec.signal.throwIfAborted();
      if(!exec.agent)throw new Error('保存需要当前会话');
      const input=saveInput.parse(args);
      const previous=input.id?await ctx.snowTrip.getPackage(input.id):null;
      if(input.id&&(!previous||previous.revision!==input.expectedRevision))throw new Error('套餐不存在或版本已变更，请重新查询后确认');
      if(previous&&!Object.keys(input.package).length)throw new Error('请提供本次补充字段');
      const base=previous?Object.fromEntries(Object.keys(properties).map(key=>[key,previous[key as keyof typeof previous]])):{};
      const draft=normalizePackage({...base,...input.package});
      // 确认与写入共享局部快照，不接受模型授权，也不跨调用缓存确认。
      const answer=await ctx.userQuestions.ask({agent:exec.agent,signal:exec.signal,questions:[{
        id:'save-package',header:previous?'确认补全套餐':'确认新增套餐',question:previous?'确认更新这份套餐？':'确认保存以下套餐？',detail:((previous?`更新套餐 ${previous.id} · 版本 ${previous.revision} → ${previous.revision+1}\n本次字段：${Object.keys(input.package).join('、')}\n`:'')+packageSummary(draft)).split('\n').map(line=>'    '+line).join('\n'),
        options:[{label:'确认保存'},{label:'暂不保存'}],
      }]});
      exec.signal.throwIfAborted();
      if(answer.answers.length!==1||answer.answers[0]?.id!=='save-package'||answer.answers[0].selected.length!==1||answer.answers[0].selected[0]!=='确认保存'||answer.answers[0].custom?.trim())throw new Error('未确认当前摘要，套餐未保存');
      const now=new Date().toISOString();
      const record=packageRecord.parse({...draft,id:previous?.id??randomUUID(),revision:previous?previous.revision+1:1,schemaVersion:1,createdAt:previous?.createdAt??now,updatedAt:now,sessionId:exec.agent.id});
      await ctx.snowTrip.savePackage(record,input.expectedRevision);
      return record;
    },
  }));
}
