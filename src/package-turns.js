// 每次提交独立投影，确认与结果共用 callId；宿主折叠工具过程时卡片仍可见。
export const saveTurnDefinition={
  kind:'snowSaves',
  match:event=>event.type==='turn/start'?{id:String(event.data.turn),role:'start'}:
    event.type==='tool/call'||(event.type==='tool/result'&&event.surfaceOp==='append')?{id:String(event.data.turn),role:'update'}:null,
  start:(_context,{event})=>({turn:event.data.turn,items:[]}),
  update:({state},{event})=>{
    if(event.type==='tool/call')return event.data.name==='snow_commit'?{...state,items:[...state.items,{callId:String(event.data.callId)}]}:state;
    const callId=String(event.data.message.source.callId);
    if(!state.items.some(item=>item.callId===callId))return state;
    const result=event.data.message.content[0];
    return {...state,items:state.items.map(item=>item.callId===callId?{...item,done:true,meta:event.data.meta,error:result.isError?result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n')||'保存失败，请重新查询后调整。':null}:item)};
  },
  buildLocationData:({state},scope,previous)=>scope!=='turn'||!state?null:previous?.value===state.items?previous:{kind:'turn',turn:state.turn,key:'snowSaves',value:state.items},
};
