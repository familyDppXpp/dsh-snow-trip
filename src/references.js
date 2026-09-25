import {z} from 'zod';
const reference=z.strictObject({type:z.enum(['package','plan']),id:z.uuid()});
export const referenceSource={
  name:'snow-record',trigger:'@',
  candidates:async()=>[],onPick:()=>undefined,
  codec:{
    clipboardText:ref=>JSON.stringify(reference.parse(JSON.parse(ref))),
    serialize:async ref=>JSON.stringify(reference.parse(JSON.parse(ref))),
  },
};
export function recordReferenceSource(remote,getInput) {
  return {...referenceSource,showGroupTitle:false,
    async candidates(session,{query,signal}) {
      const results=await Promise.all([remote.listPackages(),remote.listPlans()]);
      if(signal.aborted)return [];
      for(const result of results)if(!result.ok)throw new Error(result.error.message);
      const selected=getInput(session.sessionId)?.state.getSnapshot().occurrences??[];
      const needle=query.trim().toLocaleLowerCase();
      return results.flatMap((result,index)=>{
        const type=index===0?'package':'plan',section=index===0?'套餐':'方案';
        return result.value.flatMap(record=>{
          const name=record.name??record.title;
          const value=JSON.stringify(reference.parse({type,id:record.id}));
          if(!name.toLocaleLowerCase().includes(needle)||selected.some(item=>item.source===referenceSource.name&&item.ref===value))return [];
          return [{name,section,value}];
        });
      });
    },
    onPick({candidate}) {
      const parsed=reference.parse(JSON.parse(candidate.value));
      const ref=JSON.stringify(parsed);
      return {insert:{source:referenceSource.name,ref,clipboardText:ref,label:`${parsed.type==='package'?'套餐':'方案'}：${candidate.name}`}};
    },
  };
}
export function addRecordReference(input,record,type) {
  const ref=JSON.stringify(reference.parse({type,id:record.id}));
  const state=input.state.getSnapshot();
  if(state.occurrences.some(item=>item.source===referenceSource.name&&item.ref===ref))return false;
  // 宿主 TokenSpan 使用检测文本坐标，每个引用标签占一个字符。
  const end=state.draft.length-state.occurrences.reduce((sum,item)=>sum+item.length-1,0);
  if(!input.insertReference({source:referenceSource.name,ref,label:`${type==='package'?'套餐':'方案'}：${record.name??record.title}`,clipboardText:ref},{start:end,end,draftRev:state.draftRev}))throw new Error('输入框正在处理消息，请稍后重试添加。');
  return true;
}

// 只投影完整的套餐/方案引用，原消息和模型上下文保持不变。
export function splitRecordReferences(text) {
  const parts=[];let cursor=0;
  for(const match of text.matchAll(/\{[^{}]*\}/g)) {
    let parsed;
    try{parsed=reference.safeParse(JSON.parse(match[0]));}catch{continue;}
    if(!parsed.success)continue;
    if(match.index>cursor)parts.push(text.slice(cursor,match.index));
    parts.push({...parsed.data,raw:match[0]});cursor=match.index+match[0].length;
  }
  if(cursor<text.length)parts.push(text.slice(cursor));
  return parts;
}

// 宿主草稿只保存 clipboardText；首次载入后用原生插入接口还原标签。
export function restoreDraftReferences(input,remote) {
  let disposed=false,started=false;
  const restore=async()=>{
    const initial=input.state.getSnapshot();
    if(disposed||started||!initial.draft)return;
    started=true;
    const refs=splitRecordReferences(initial.draft).filter(part=>typeof part!=='string');
    const labels=await Promise.all(refs.map(async ref=>{
      try{
        const result=await (ref.type==='package'?remote.getPackage(ref.id):remote.getPlan(ref.id));
        return result.ok?(result.value?.name??result.value?.title):null;
      }catch{return null;}
    }));
    if(disposed||input.state.getSnapshot().draftRev!==initial.draftRev)return;
    let offset=0,index=0;
    for(const part of splitRecordReferences(initial.draft)) {
      if(typeof part==='string'){offset+=part.length;continue;}
      const state=input.state.getSnapshot();
      const existing=state.occurrences.some(item=>item.offset===offset&&item.length===part.raw.length);
      if(!existing){
        const start=offset-state.occurrences.filter(item=>item.offset<offset).reduce((n,item)=>n+item.length-1,0);
        const ref=JSON.stringify({type:part.type,id:part.id});
        if(!input.insertReference({source:referenceSource.name,ref,clipboardText:part.raw,label:`${part.type==='package'?'套餐':'方案'}：${labels[index]??part.id.slice(0,8)}`},{start,end:start+part.raw.length,draftRev:state.draftRev}))return;
        // 原生接口在引用后没有空格时会追加一个分隔空格。
        offset+=input.state.getSnapshot().draft.length-state.draft.length;
      }
      offset+=part.raw.length;index++;
    }
  };
  const unsubscribe=input.state.subscribe(()=>{void restore();});
  void restore();
  return()=>{disposed=true;unsubscribe();};
}
