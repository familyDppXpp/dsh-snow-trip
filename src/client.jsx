import React, { useEffect, useRef, useState } from 'react';
import {SavedPackageCard} from './package-cards.jsx';
import { App } from './workbench.jsx';
import { createSnowSession, openSnowSession, renameSnowSession, mirrorQuestions } from './sessions.js';
import remote from '../lib/typert.remote-client.js';
import styles from './style.css';

export const inject=['slots','modules','sessions','remote','uiSession'];
const uiPlugins=['ui-renderer','locale','ui-session','ui-workspace','ui-conversation','ui-chat','ui-attachment','ui-tool','ui-user-questions','ui-input-trigger','ui-commands','ui-skill','ui-model-selection','ui-permission-presets'];

function Entry({wide, prepare}) {
  const dialog=useRef(null),container=useRef(null);
  const [opened,setOpened]=useState(false),[error,setError]=useState('');
  useEffect(()=>{
    if(!opened)return;
    let active=true,unmount;
    prepare(()=>dialog.current.close()).then(mount=>{
      if(active)unmount=mount(container.current);
    }).catch(error=>{if(active)setError(`工作台加载失败：${error.message}`);});
    return()=>{active=false;unmount?.();};
  },[opened,prepare]);
  return <><button className="snow-entry" aria-label="打开雪季出行工作台" title="雪季出行工作台" onClick={()=>{setError('');setOpened(true);dialog.current.showModal();}}>△{wide&&' 雪季出行'}</button>
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
      for(const key of ['slots','uiRenderer','uiSession','uiConversation','conversation','locale','uiWorkspace','inputTriggers','commandUi','modelDirectories'])local=local.isolate(key);
      for(const key of uiPlugins){
        const plugin=await ctx.modules.import(`@deepseek-ai/dsh-client-${key}/client`);
        await local.plugin({name:`snow-trip-${key}`,inject:plugin.inject,Config:plugin.Config,apply:plugin.apply});
      }
      await local.plugin({
        name:'snow-trip-session-entry',inject:['slots','uiRenderer','uiSession','sessions','workspaces','conversation','remote','remote.agentPresets','remote.snowTrip'],
        apply(view){
          view.effect(()=>mirrorQuestions(ctx.uiSession.pendingInteractions,view.uiSession));
          view.slots.inject('tool.call.toolview',()=>view.slots.register({name:'tool.call.toolview',key:'snow_save_packages'},SavedPackageCard));
          const actions={
            listPackages:async()=>{const result=await view.remote.snowTrip.listPackages();if(!result.ok)throw new Error(result.error.message);return result.value;},
            lastSession:()=>lastSession,
            sessionState:id=>view.sessions.binding(id)?.session,
            workspaceList:{subscribe:listener=>view.workspaces.list.subscribe(listener),getSnapshot:()=>view.workspaces.list.getSnapshot()},
            archive:async id=>{await view.workspaces.archiveSession(id);if(lastSession===id)lastSession=undefined;},
            fork:async id=>{const child=await view.sessions.fork({sessionId:id,increaseTitle:true});await view.sessions.refresh();openSnowSession(view.sessions,child);lastSession=child;return child;},
            rename:(id,title)=>renameSnowSession(view.sessions,id,title),
            close:()=>close(),
            create:async(draft)=>{
              const result=await view.remote.snowTrip.ensureWorkspace();
              if(!result.ok)throw new Error(`准备工作区失败：${result.error.message}`);
              const workspace=await view.workspaces.create({path:result.value});
              const id=await createSnowSession(view.sessions,view.remote.agentPresets,view.conversation.input,workspace.workspaceId,draft);
              lastSession=id;return id;
            },
            continuePackage:record=>{openSnowSession(view.sessions,record.sessionId);lastSession=record.sessionId;},
            open:id=>{openSnowSession(view.sessions,id);lastSession=id;},
          };
          view.slots.register({name:'root',children:{conversation:{kind:'single',scope:'session-maybe'}},inject:()=>({actions})},App);
          mount=container=>{
            if(lastSession){try{actions.open(lastSession);}catch{lastSession=undefined;}}
            return view.uiRenderer.mount(container);
          };
        },
      });
    }});
    try{await fiber;return mount;}catch(error){await fiber.dispose();throw error;}
  }
  ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'dsh-snow-trip',inject:()=>({prepare})},Entry));
}
