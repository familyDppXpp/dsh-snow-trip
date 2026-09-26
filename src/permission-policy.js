// 仅装配在 snow-trip 预设下，命令和模型组装监听均随该会话作用域释放。
export const name='snow-trip-permissions';
export const inject=['commands','permissionPresets'];
export function apply(ctx) {
  const enforce=agent=>ctx.permissionPresets.set(agent.session,'workspace-write');
  ctx.commands.register({
    definitionId:'dsh-snow-trip/permission',name:'permission',description:'雪季工作台固定使用工作区内修改权限',input:{hint:'workspace-write'},
    handler:({agent,rawInput})=>{
      enforce(agent);
      return rawInput.trim()&&rawInput.trim()!=='workspace-write'
        ?{kind:'error',text:'雪季工作台权限固定为“工作区内修改”，不可切换。'}
        :{kind:'success',text:'雪季工作台权限：工作区内修改（固定）。'};
    },
  });
  ctx.on('system-prompt/assemble',(_assembly,context,next)=>{
    if(context.agent)enforce(context.agent);
    return next();
  });
}
