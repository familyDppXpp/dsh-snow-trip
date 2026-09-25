import React,{useEffect,useRef,useState,useSyncExternalStore} from 'react';

const placeholder='想去哪座山？也可以贴上套餐，或输入 @ 引用已有资料';

export function DepartureHero({selection,inputFor,chooseSkill}) {
  const sessionId=useSyncExternalStore(selection.subscribe,selection.getSnapshot)?.sessionId,root=useRef(null);
  const input=inputFor(sessionId);
  const draft=useSyncExternalStore(listener=>input.state.subscribe(listener),()=>input.state.getSnapshot().draft);
  const [error,setError]=useState('');
  useEffect(()=>{
    const host=root.current.closest('[data-phase="hero"]');
    if(!host)return;
    host.classList.add('snow-departure');
    const decorate=()=>{
      const editor=host.querySelector('[data-composer-input]');
      if(editor){editor.dataset.placeholder=placeholder;editor.setAttribute('aria-label',placeholder);}
      const hint=host.querySelector('[data-composer-placeholder]');
      if(hint&&hint.textContent!==placeholder)hint.textContent=placeholder;
    };
    const observer=new MutationObserver(decorate);observer.observe(host,{childList:true,subtree:true});decorate();
    return()=>{observer.disconnect();host.classList.remove('snow-departure');};
  },[sessionId]);
  return <div className="snow snow-departure-welcome" ref={root}>
    <svg className="snow-departure-mountains" viewBox="0 0 320 200" fill="none" aria-hidden="true"><path d="m8 171 62-73 32 39 69-104 91 124 29-33 21 47" stroke="currentColor" strokeWidth="1.2"/><path d="m102 137 26 33 43-137 35 108 56 16M143 75l16 7 12-49 24 67 13-9M46 128l24-30 15 19" stroke="currentColor" strokeWidth=".8"/><path d="M8 179c57-17 89 15 139 0s104-8 165 6" stroke="currentColor" strokeWidth=".8"/><circle cx="257" cy="52" r="13" fill="#d2b58a" fillOpacity=".55"/></svg>
    <span className="snow-departure-season">26 / 27 雪季 · 山野计划</span>
    <h1><span>下一站，</span>去山里过冬。</h1>
    <p>记下手里的套餐，聊聊想去的地方。<br/>这个雪季，把好时光留给山野。</p>
    <div className="snow-departure-shortcuts" aria-label="开始雪季计划">
      {[['snow-import','录入套餐','贴上说明或上传截图'],['snow-plan','规划出行','从已有套餐安排旅程']].map(([skill,label,description])=><button key={skill} aria-pressed={draft.startsWith(`/${skill} `)} onClick={()=>{
        try{chooseSkill(sessionId,skill);setError('');root.current.closest('[data-phase="hero"]')?.querySelector('[contenteditable="true"]')?.focus();}
        catch(error){setError(error.message);}
      }}><span className="snow-shortcut-icon" aria-hidden="true"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={skill==='snow-import'?'M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h5':'m3 19 6-13 5 9 3-6 4 10H3M9 6l2 4M4 4h2'}/></svg></span><span className="snow-shortcut-copy"><strong>{label}</strong><small>{description}</small></span><span className="snow-shortcut-check" aria-hidden="true">✓</span></button>)}
    </div>
    {error&&<p role="alert" className="error">{error}</p>}
  </div>;
}
