window.__ModuleLoader__.load({id:'snow-session-check',factory:()=>({
  inject:['sessions','workspaces','remote','remote.agentPresets','remote.snowTrip'],
  apply(ctx){
    window.snowSessionCheck={
      permissionState:id=>ctx.sessions.binding(id)?.session.projections.faceOf('permissions').getSnapshot(),
      permission:(id,preset)=>ctx.sessions.using(id,{source:'snowSessionCheck'},async reference=>{await reference.ready;return reference.binding.session.command(`/permission ${preset}`);}),
      state:()=>{const state=ctx.sessions.list.getSnapshot();return {...state,current:Object.values(state.byId).find(row=>row.retainedBy?.snowTrip)?.id};},
      workspaces:()=>ctx.workspaces.list.getSnapshot(),
      presets:()=>ctx.remote.agentPresets.list(),
      listPackages:()=>ctx.remote.snowTrip.listPackages(),
      workspace:path=>ctx.workspaces.create({path}),
      normal:workspaceId=>ctx.sessions.create({workspaceId}),
      open:id=>ctx.uiWorkspace.openSession(id),
    };
    ctx.effect(()=>()=>{delete window.snowSessionCheck;});
  },
})});
