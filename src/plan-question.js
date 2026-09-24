// SNOW-06 方案问题卡：LLM 经 ask_user_question 的 plan-plan 问题在会话内呈现为
// 阶段卡片。问题 id 前缀 snow-plan-，detail 携带阶段 JSON；回答仍走通用选项。
import {z} from 'zod';

// detail 的阶段负载：confirm=条件确认、estimate=估算确认、results=结果列表、
// discussion=讨论比较、review=回顾快照、status=状态。全部字段宽松可选。
export const planQuestionSchema=z.looseObject({
  stage:z.enum(['confirm','estimate','results','discussion','review','status']),
  input:z.looseObject({start:z.string().optional(),nights:z.union([z.string(),z.number()]).optional(),budget:z.union([z.string(),z.number()]).optional()}).optional(),
  ids:z.array(z.string()).optional(),
  suggestions:z.looseObject({start:z.string().optional(),nights:z.union([z.string(),z.number()]).optional()}).optional(),
  estimates:z.array(z.looseObject({label:z.string(),amount:z.union([z.string(),z.number()]).optional(),basis:z.string().optional()})).optional(),
  start:z.string().nullable().optional(),
  nights:z.number().nullable().optional(),
  scope:z.string().optional(),
  suggested:z.looseObject({start:z.boolean().optional(),nights:z.boolean().optional()}).optional(),
  results:z.array(z.unknown()).optional(),
  selected:z.array(z.number().int()).optional(),
  message:z.string().optional(),
  parent:z.string().nullable().optional(),
  notice:z.looseObject({title:z.string(),text:z.string(),tone:z.string().optional(),actions:z.array(z.looseObject({label:z.string(),value:z.string()})).optional()}).optional(),
  packages:z.array(z.unknown()).optional(),
});

// 判定一个 pending 交互是否为方案问题卡；返回解析后的负载或 null。
export function planQuestion(pending) {
  const q=pending?.questions?.[0];
  if(pending?.questions?.length!==1||!q?.id.startsWith('snow-plan-'))return null;
  try{
    const raw=JSON.parse(q.detail??'{}');
    const parsed=planQuestionSchema.safeParse(raw);
    if(!parsed.success)return null;
    // id 与负载自洽：snow-plan-<stage>-<key>
    if(q.id!==`snow-plan-${raw.stage}-${raw.key}`)return null;
    return {...parsed.data,callId:q.id,questionText:q.question??"",pending:q};
  }catch{return null;}
}

// 构造 ask_user_question 请求项（服务端工具侧使用）。
export function planQuestionItem(stage,key,detail,options,header,multiSelect=false) {
  return {id:`snow-plan-${stage}-${key}`,question:detail.question??'',detail:JSON.stringify({...detail,stage,key}),...(header?{header}:{}) ,...(options?{options,multiSelect}:{})};
}
