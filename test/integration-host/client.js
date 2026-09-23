window.__ModuleLoader__.load({id:'snow-session-check',factory:()=>({
  inject:['sessions','workspaces','remote','remote.agentPresets','remote.snowTrip'],
  apply(ctx){
    window.snowSessionCheck={
      state:()=>ctx.sessions.list.getSnapshot(),
      workspaces:()=>ctx.workspaces.list.getSnapshot(),
      presets:()=>ctx.remote.agentPresets.list(),
      listPackages:()=>ctx.remote.snowTrip.listPackages(),
      workspace:path=>ctx.workspaces.create({path}),
      normal:workspaceId=>ctx.sessions.create({workspaceId}),
      open:id=>ctx.sessions.open(id),
    };
    ctx.effect(()=>()=>{delete window.snowSessionCheck;});
  },
})});
