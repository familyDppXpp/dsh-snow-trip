import {packageMetadata} from './packages.ts';

export function selectTurnPackages({turn,seq}) {
  const records=new Map();
  for(const item of turn.data.get('snowPackages')??[])if(item.seq<=seq)records.set(item.record.id,item.record);
  return records.size?[...records.values()]:null;
}
// 使用宿主轮次索引，历史回放和实时结果共用同一投影，不依赖工具组是否展开。
export const packageTurnDefinition={
  kind:'snowPackages',
  match:event=>event.type==='turn/start'?{id:String(event.data.turn),role:'start'}:
    event.type==='tool/call'||(event.type==='tool/result'&&event.surfaceOp==='append')?{id:String(event.data.turn),role:'update'}:null,
  start:(_context,{event})=>({turn:event.data.turn,calls:new Set(),records:[]}),
  update:({state},{event})=>{
    if(event.type==='tool/call'){
      if(!['snow_commit','snow_save_packages'].includes(event.data.name))return state;
      return {...state,calls:new Set([...state.calls,String(event.data.callId)])};
    }
    const result=event.data.message.content[0];
    if(result.isError||!state.calls.has(String(event.data.message.source.callId)))return state;
    const record=packageMetadata(event.data.meta);
    return record?{...state,records:[...state.records,{seq:event.seq,record}]}:state;
  },
  buildLocationData:({state},scope,previous)=>{
    if(scope!=='turn'||!state)return null;
    if(previous?.kind==='turn'&&previous.turn===state.turn&&previous.value===state.records)return previous;
    return {kind:'turn',turn:state.turn,key:'snowPackages',value:state.records};
  },
};
