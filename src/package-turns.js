import {normalizePackage,saveMetadata} from './packages.ts';
// 每次提交独立投影，确认与结果共用 callId；宿主折叠工具过程时卡片仍可见。
// 方案核算与保存结果同样挂到轮次末尾，不退化为折叠的工具步骤。
export const saveTurnDefinition={
  kind:'snowSaves',
  match:event=>event.type==='turn/start'?{id:String(event.data.turn),role:'start'}:
    event.type==='tool/call'||(event.type==='tool/result'&&event.surfaceOp==='append')?{id:String(event.data.turn),role:'update'}:null,
  start:(_context,{event},reader)=>{
    const previous=reader?.previous('snowSaves')?.state;
    return {turn:event.data.turn,items:[],drafts:previous?.drafts??{},records:previous?.records??{},calls:{}};
  },
  update:({state},{event})=>{
    if(event.type==='tool/call'){
      const callId=String(event.data.callId);
      if(event.data.name==='snow_commit'){
        let draftId;try{draftId=JSON.parse(event.data.arguments).draftId;}catch{}
        const snapshot=state.drafts[draftId];
        return {...state,items:[...state.items,{callId,...(snapshot?{snapshot}:{})}]};
      }
      // 方案核算与保存结果在轮次末尾展示卡片；输入不完整时不占位。
      if(['snow_evaluate','snow_save_plan'].includes(event.data.name))return {...state,items:[...state.items,{callId,kind:event.data.name}]};
      return event.data.name.startsWith('snow_')?{...state,calls:{...state.calls,[callId]:true}}:state;
    }
    const callId=String(event.data.message.source.callId);
    const result=event.data.message.content[0];
    const pending=state.items.find(item=>item.callId===callId);
    if(pending&&pending.kind)return {...state,items:state.items.map(item=>item.callId===callId?{...item,done:true,meta:event.data.meta,error:result.isError?result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n')||'执行失败，请调整后重试。':null}:item)};
    if(!state.items.some(item=>item.callId===callId)){
      if(state.calls[callId]&&!result.isError){
        try{
          const draft=JSON.parse(result.content.filter(c=>c.type==='text').map(c=>c.text).join(''));
          if(draft.status==='draft'&&draft.draftId&&draft.amountUnit==='元'&&draft.package){
            const data={...draft.package};
            for(const key of ['quote','paid','paidExtra'])if(typeof data[key]==='number')data[key]=Math.round(data[key]*100);
            const previous=draft.id?state.records[draft.id+':'+draft.expectedRevision]:null;
            // 缺少修改前的历史版本时，不把修改卡片降级为完整套餐详情。
            if(draft.id&&!previous)return state;
            return {...state,drafts:{...state.drafts,[draft.draftId]:{previous,preview:normalizePackage(data)}}};
          }
        }catch{}
      }
      return state;
    }
    const saved=saveMetadata(event.data.meta)?.record;
    const records=saved?{...state.records,[saved.id+':'+saved.revision]:saved}:state.records;
    const error=result.isError?result.content?.filter(c=>c.type==='text').map(c=>c.text).join('\n')||'保存失败，请重新查询后调整。':null;
    const stopped=error==='Error: ask_user_question was aborted before the user answered';
    return {...state,records,items:state.items.map(item=>item.callId===callId?{...item,done:true,meta:event.data.meta,stopped,error:stopped?null:error}:item)};
  },
  buildLocationData:({state},scope,previous)=>scope!=='turn'||!state?null:previous?.value===state.items?previous:{kind:'turn',turn:state.turn,key:'snowSaves',value:state.items},
};
