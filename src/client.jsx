import React, { useEffect, useRef, useState } from 'react';
import {SavedPackageCard,PlanInteractionCard,QuestionAnswerCard} from './package-cards.jsx';
import { App, PackageSidebarToggle } from './workbench.jsx';
import { createSnowSession, continueSnowSession, openSnowSession, renameSnowSession, mirrorQuestions } from './sessions.js';
import {saveTurnDefinition,confirmedPlanDefinition,questionAnswerDefinition} from './package-turns.js';
import {SaveCard,SaveCards,saveQuestion} from './save-card.jsx';
import {PlanQuestionCard,PlanStageFailure} from './plan-question-card.jsx';
import {planQuestion} from './plan-question.js';
import remote from '../lib/typert.remote-client.js';
import styles from './style.css';
import {referenceSource,appendRecordPrompt,recordReferenceSource,addRecordReference,restoreDraftReferences} from './references.js';
import {registerReferenceMessages} from './reference-message.jsx';
import {DepartureHero} from './departure.jsx';

export const inject=['slots','modules','sessions','remote','uiSession','uiConversation'];
const uiPlugins=['ui-renderer','locale','shortcuts','ui-session','ui-workspace','ui-conversation','ui-chat','ui-attachment','ui-tool','ui-user-questions','ui-input-trigger','ui-commands','ui-skill','ui-model-selection','ui-permission-presets'];

function SnowConversation({useSession,useConversation,renderFactorySlot}) {
  const session=useSession(value=>value),conversation=useConversation(value=>value);
  const active=conversation.activeTargets.size>0||(!session.blank&&!session.awaitingFirstTurn)||session.running;
  const hero=!active;
  return renderFactorySlot('conversation.content',{variant:'embedded',phase:hero?'hero':'active',hero},{
    slots:{views:({renderSlot})=>renderSlot('conversation.session',{view:'chat'})},
  });
}

function Entry({wide, prepare}) {
  const dialog=useRef(null),container=useRef(null);
  const [opened,setOpened]=useState(()=>new URLSearchParams(window.location.search).get('app')==='snow-trip'),[error,setError]=useState('');
  useEffect(()=>{
    if(!opened)return;
    dialog.current.showModal();
    let active=true,unmount;
    prepare(()=>dialog.current.close()).then(mount=>{
      if(active)unmount=mount(container.current);
    }).catch(error=>{if(active)setError(`工作台加载失败：${error.message}`);});
    return()=>{active=false;unmount?.();};
  },[opened,prepare]);
  return <><button className="snow-entry" aria-label="打开雪季出行工作台" title="雪季出行工作台" onClick={()=>{setError('');setOpened(true);}}>△{wide&&' 雪季出行'}</button>
    <dialog className="snow-shell" ref={dialog} aria-label="雪季出行工作台" onClose={event=>{if(event.target===dialog.current)setOpened(false);}}>
      {error&&<div className="snow" role="alert">{error}<button onClick={()=>dialog.current.close()}>返回 DSH</button></div>}
      <div ref={container} className="snow-mount"/>
    </dialog></>;
}

export async function apply(ctx) {
  ctx.effect(()=>{
    const style=document.createElement('style');style.textContent=styles;document.head.append(style);
    return ()=>style.remove();
  });
  await ctx.remote.$mount(remote);
  let ready,close,lastSession;
  const prepare=onClose=>{
    close=onClose;
    ready??=assemble().catch(error=>{ready=undefined;throw error;});
    return ready;
  };
  async function assemble() {
    let mount;
    const fiber=ctx.plugin({name:'snow-trip-workbench',async apply(scope){
      let local=scope;
      // 输入扩展在本工作台重新装配，避免继承主界面的命令和草稿状态。
      for(const key of ['slots','uiRenderer','uiSession','uiConversation','conversation','locale','uiWorkspace','inputTriggers','commandUi','modelDirectories','shortcuts'])local=local.isolate(key);
      for(const key of uiPlugins){
        const plugin=await ctx.modules.import(`@deepseek-ai/dsh-client-${key}/client`);
        try{await local.plugin(typeof plugin==='function'?plugin:{name:`snow-trip-${key}`,inject:plugin.inject,Config:plugin.Config,apply:plugin.apply});}catch(error){throw new Error(`加载 ${key} 失败：${error.message}`,{cause:error});}
      }
      await local.plugin({
        name:'snow-trip-session-entry',inject:['uiConversation','slots','uiRenderer','uiSession','sessions','workspaces','conversation','inputTriggers','remote','remote.agentPresets','remote.snowTrip'],
        apply(view){
          const selectionListeners=new Set();
          let reference;
          const select=id=>{
            if(reference?.sessionId===id)return;
            const previous=reference;
            reference=view.sessions.retain(id,{source:'snowTrip'});
            previous?.release();
            for(const listener of selectionListeners)listener();
          };
          view.effect(()=>()=>reference?.release());
          const selection={getSnapshot:()=>reference,subscribe:listener=>{selectionListeners.add(listener);return()=>selectionListeners.delete(listener);}};

          view.slots.inject('conversation.hero.brand.mark',()=>view.slots.register({name:'conversation.hero.brand.mark',inject:()=>({
            selection,
            inputFor:id=>view.conversation.input.for(view.sessions.scope(id)),
            chooseSkill:(id,skill)=>{
              const scope=view.sessions.scope(id),input=view.conversation.input.for(scope),state=input.state.getSnapshot();
              if(state.phase!=='plain')throw new Error('请先完成当前输入操作。');
              const leading=state.draft.match(/^\/(?:snow-import|snow-plan)(?:\s+|$)/)?.[0]??'';
              if(!input.insertText(`/${skill} `,{start:0,end:leading.length,draftRev:state.draftRev}))throw new Error('选择技能失败，请重试。');
            },
          })},DepartureHero));
          view.uiConversation.events.register(saveTurnDefinition);
          registerConfirmedPlan(view);
          registerReferenceMessages(view);
          view.uiConversation.events.register(questionAnswerDefinition);
          view.slots.inject('conversation.chat.node',()=>view.slots.register({name:'conversation.chat.node',key:'snow-question-answer'},({node})=><QuestionAnswerCard data={node.data}/>));
          view.slots.inject('conversation.chat.node',()=>view.slots.register({name:'conversation.chat.node',key:'system-prompt',priority:-1},()=>null));
          view.slots.inject('conversation.chat.node',()=>view.slots.register({name:'conversation.chat.node',key:'turn-process'},({node,turnProcess})=>node.location.turn?.status==='open'
            ?<div className="snow-running" role="status"><span aria-hidden="true"/>正在处理…</div>
            :turnProcess?.foldable&&turnProcess.hasContent?<button type="button" className="snow-process-toggle" data-turn-process="" aria-expanded={turnProcess.open} onClick={()=>turnProcess.setOpen(!turnProcess.open)}>{turnProcess.open?'收起执行过程':'查看执行过程'}</button>:null));

          // 使用宿主的轮次末尾扩展点，结果不插入旧消息，也不受工具折叠影响。
          view.slots.inject('conversation.chat.turnTail',()=>view.slots.register({
            name:'conversation.chat.turnTail',id:'snow-stopped-workbench',priority:-1,
            select:({turn})=>{const items=turn.data.get('snowSaves')?.filter(item=>item.stopped);return items?.length?items:null;},
          },({matched,sessionId})=><SaveCards items={matched} store={view.uiSession.sessionStatus} sessionId={sessionId}/>));
          view.slots.inject('conversation.composer',()=>view.slots.register({name:'conversation.composer',priority:-1,select:({pendingInteraction})=>planQuestion(pendingInteraction)?pendingInteraction:(saveQuestion(pendingInteraction)?pendingInteraction:null)},({matched})=> planQuestion(matched)?<div className="snow snow-save-composer"><PlanQuestionCard key={matched.key} pending={matched}/></div>:<div className="snow snow-save-composer"><SaveCard key={matched.key} item={{callId:saveQuestion(matched).callId}} pending={matched}/></div>));
          view.effect(()=>mirrorQuestions(ctx.uiSession.sessionStatus,view.uiSession));
          view.slots.inject('tool.call.toolview',()=>view.slots.register({name:'tool.call.toolview',key:'snow_save_packages'},SavedPackageCard));
          view.slots.inject('conversation.session.header.utilities',()=>view.slots.register({name:'conversation.session.header.utilities',id:'snow-package-sidebar'},PackageSidebarToggle));
          view.effect(()=>view.inputTriggers.registerSource(recordReferenceSource(view.remote.snowTrip,id=>{const scope=view.sessions.scope(id);return scope?view.conversation.input.for(scope):null;})));
          const actions={
            selection,
            referenceAt:(sessionId,index)=>{
              const scope=view.sessions.scope(sessionId);
              const item=scope&&view.conversation.input.for(scope).state.getSnapshot().occurrences[index];
              return item?.source===referenceSource.name?JSON.parse(item.ref):null;
            },
            restoreReferences:sessionId=>{
              const scope=view.sessions.scope(sessionId);
              if(scope)return restoreDraftReferences(view.conversation.input.for(scope),view.remote.snowTrip);
            },
            addReference:(sessionId,record,type)=>{
              const scope=view.sessions.scope(sessionId);
              if(!scope)throw new Error('当前会话尚未就绪，请稍后重试。');
              return addRecordReference(view.conversation.input.for(scope),record,type);
            },
            deletePlan:async id=>{
              const result=await view.remote.snowTrip.deletePlan(id);if(!result.ok)throw new Error(result.error.message);
              if(result.value.sessionId===lastSession)lastSession=undefined;
              if(result.value.archiveError)return `方案已删除，但会话归档失败：${result.value.archiveError}。请从会话菜单重试归档。`;
              return result.value.sessionId?'方案已删除，会话已归档。':'方案已删除。';
            },
            listPlans:async()=>{const result=await view.remote.snowTrip.listPlans();if(!result.ok)throw new Error(result.error.message);return result.value;},
            listPackages:async()=>{const result=await view.remote.snowTrip.listPackages();if(!result.ok)throw new Error(result.error.message);return result.value;},
            deletePackage:async(record,archive,plans=[])=>{
              const result=await view.remote.snowTrip.deletePackage(record.id,record.revision,archive,plans.map(plan=>plan.id));
              if(!result.ok)throw new Error(result.error.message);
              if(result.value.sessionId===lastSession||plans.some(plan=>plan.sessionId===lastSession))lastSession=undefined;
              if(result.value.archiveError)return `套餐及关联方案已删除，但会话归档失败：${result.value.archiveError}。请从会话菜单重试归档。`;
              return `套餐已删除${plans.length?`，已一并删除 ${plans.length} 份方案`:''}${result.value.sessionId?'，会话已归档':''}。`;
            },
            lastSession:()=>lastSession,
            sessionState:id=>view.sessions.binding(id)?.session,
            workspaceList:{subscribe:listener=>view.workspaces.list.subscribe(listener),getSnapshot:()=>view.workspaces.list.getSnapshot()},
            archive:async id=>{const result=await view.remote.snowTrip.archiveSession(id);if(!result.ok)throw new Error(result.error.message);if(lastSession===id)lastSession=undefined;},
            fork:async id=>{const child=await view.sessions.fork({sessionId:id,increaseTitle:true});await view.sessions.refresh();openSnowSession(view.sessions,child,select);lastSession=child;return child;},
            rename:(id,title)=>renameSnowSession(view.sessions,id,title),
            close:()=>close(),
            create:async(draft,record)=>{
              const result=await view.remote.snowTrip.ensureWorkspace();
              if(!result.ok)throw new Error(`准备工作区失败：${result.error.message}`);
              const workspace=await view.workspaces.create({path:result.value});
              const id=await createSnowSession(view.sessions,view.remote.agentPresets,view.conversation.input,workspace.workspaceId,record?undefined:draft,select);
              if(record)appendRecordPrompt(view.conversation.input.for(view.sessions.scope(id)),draft,record);
              lastSession=id;return id;
            },
            continueRecord:async(record,prompt)=>{
              const opened=await continueSnowSession(view.sessions,view.conversation.input,view.workspaces.list.getSnapshot().archivedSessionIds,record.sessionId,prompt,record,select);
              if(opened)lastSession=record.sessionId;
              return opened;
            },
            open:id=>{openSnowSession(view.sessions,id,select);lastSession=id;},
          };
          view.slots.register({name:'root',children:{main:{kind:'keyed',scope:'root'},'snow.conversation':{kind:'single',scope:'session'}},inject:()=>({actions})},App);
          view.slots.register({name:'snow.conversation'},SnowConversation);
          mount=container=>{
            if(lastSession){try{actions.open(lastSession);}catch{lastSession=undefined;}}
            return view.uiRenderer.mount(container);
          };
        },
      });
    }});
    try{await fiber;return mount;}catch(error){await fiber.dispose();throw error;}
  }
  ctx.uiConversation.events.register(saveTurnDefinition);
  ctx.slots.inject('conversation.chat.turnTail',()=>ctx.slots.register({name:'conversation.chat.turnTail',id:'snow-stopped-main',priority:-1,select:({turn})=>{const items=turn.data.get('snowSaves')?.filter(item=>item.stopped);return items?.length?items:null;}},({matched,sessionId})=><SaveCards items={matched} store={ctx.uiSession.sessionStatus} sessionId={sessionId}/>));
  registerConfirmedPlan(ctx);
  registerReferenceMessages(ctx);
  // 主界面（工作台弹窗外）也渲染方案阶段卡片：DSH 主会话的 pendingInteraction
  // 由宿主通用 QuestionComposer 显示为选项列表；这里注册方案卡识别，优先级与
  // 工作台内一致（-1，先于宿主通用 composer，同 saveQuestion 的做法）。
  ctx.slots.inject('conversation.composer',()=>ctx.slots.register({name:'conversation.composer',id:'snow-plan-main',priority:-1,select:({pendingInteraction})=>planQuestion(pendingInteraction)||saveQuestion(pendingInteraction)?pendingInteraction:null},({matched})=><div className="snow snow-save-composer">{planQuestion(matched)?<PlanQuestionCard key={matched.key} pending={matched}/>:<SaveCard key={matched.key} item={{callId:saveQuestion(matched).callId}} pending={matched}/>}</div>));
  ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'dsh-snow-trip',inject:()=>({prepare})},Entry));
}

function registerConfirmedPlan(ctx){
 ctx.uiConversation.events.register(confirmedPlanDefinition);
 ctx.slots.inject('conversation.chat.node',()=>ctx.slots.register({name:'conversation.chat.node',key:'snow-confirmed-plan'},({node})=>node.data.version===2?<div className="snow snow-save-cards"><SaveCard item={{done:true,meta:node.data}}/></div>:<PlanInteractionCard data={node.data}/>));
}
