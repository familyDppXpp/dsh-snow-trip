# SNOW-01 验证记录

2026-09-22 完成会话接入；2026-09-23 按用户验收纠正界面范围：恢复原工作台，只在原左栏增加会话入口，去掉另起的概览与“旧版台账与方案”。此前 `HOST-CONVERSATION-EMBED` 判断已撤销：在独立 UI 上下文装配公开 client plugin 可行，无需修改宿主。

## 环境与公开接入

- macOS，Node.js 22.22.3，构建 pnpm 10.33.2；DSH CLI pnpm 11.7.0。
- DSH `0.1.5-alpha.1`，源码提交 `5dda764ed3aa172535a7967b06ff95d9cbfe536a`；使用本机已有构建，Web 标头含 `dirty`。本次未修改宿主。未验证其他版本。
- 正式 tarball 经 `dsh plugin --profile web add` 安装到 `.local/session-entry-home`，通过 CLI 在 127.0.0.1:4330 启动，Chrome/Playwright 加载实际客户端产物。不是仅运行装配探针。
- `ctx.isolate()` 隔离 slots、renderer、locale 和 conversation 等 UI 服务；通过 `ctx.modules.import('@deepseek-ai/dsh-client-…/client')` 装配 renderer、locale、session、workspace、conversation、chat、attachment、tool。共享宿主 sessions、workspaces、remote 和 fileUpload。
- `sessions.create({workspaceId})` → `remote.agentPresets.select(id, 'snow-trip')` → refresh/open；投影过滤使用 `projectionValues.agentPreset`。草稿使用公开 `conversation.input.for(scope).setDraft`，不自动 submit。
- 预设装配器读取 Web profile 原 `agent-presets` 条目的配置，追加本包目录，保留 default、原 roots 及其他配置。bundle 禁用原实例后由装配器创建单一实例；定制 profile 必须保留该条目。未穷举任意自定义 loader 编排。
- `SnowTrip` 使用公开 `TypertRemoteService` 和 `@Remote`。公开 SDK 生成 Host 描述和客户端 contribution，经 `remote.$mount` 挂载；客户端请求由宿主认证。SDK 当前按 workspace 识别类型，构建脚本临时装配本包及已安装 protocol 的公开声明，最后清理，不读取宿主源码。

## 实测结果

| 检查 | 结果 |
|---|---|
| 全新临时目录，只复制源码、manifest、锁文件，`pnpm install --frozen-lockfile` 自动 prepare | 通过，无宿主路径依赖 |
| `pnpm build`、`pnpm typecheck`、`pnpm test` | 通过；3 项通过，私人工作簿回归 1 项显式跳过 |
| tarball 独立安装，发现 snow-trip，原默认 standard 保留 | 通过 |
| 新增空白会话；不自动发送；列表排除普通会话 | 通过 |
| 用户发送文本，真实模型回复；执行中关闭工作台、重开恢复历史 | 通过，使用已配置 minimax-cn / MiniMax-M2.7 |
| 草稿编辑，标准文件输入上传真实附件，不触发模型 | 通过 |
| 关闭重开保留未发送草稿与附件，列表切回原会话 | 通过 |
| `snowTrip.listPackages` 认证调用返回 `{ok:true,value:[]}` | 通过 |
| 无 Cookie/Bearer 的同源 HTTP 请求 | 被宿主拒绝，401/403 断言通过 |
| 临时移走隔离包预设组合文件，点击新增 | 显示“雪季预设选择失败”，无错误助理输入区；文件 finally 恢复 |
| 真实模型失败 | fuyao-work 返回“API 密钥无效 / AUTH”，标准聊天显示失败 |
| 1440×1000、390×844 实际浏览器布局 | 导航及会话入口可用；截图已检查 |

成功回复示例：“滑雪前热身主要有三个作用：提升身体温度，让肌肉更灵活，降低受伤风险……”（实际输出保存在本地测试结果中，不是固定测试回复）。默认 fuyao 凭据无效后，只在隔离 profile 改用用户已配置的 MiniMax；没有修改用户默认模型或凭据。

上传 `雪季接入检查.txt` 后，在隔离 DSH_HOME 的 attachments 存储找到真实文件，字节内容与 `SNOW-01 真实附件路径检查` 一致。附件业务解析不在本票。

可运行检查：`test/session-entry.test.mjs` 覆盖创建/预设失败/草稿不发送/历史保护；`test/session-entry.integration.mjs` 与测试专用 `test/integration-host` 覆盖真实安装、模型、附件、认证和失败提示。模型成功断言检查真实 assistant-step 且无 turn-error，不能用界面文字长度判定成功。集成运行方法见 README。

2026-09-23 对最终安装产物补跑原流程：真实 Excel 导入、9 条/50 晚/34,813 元、目的地筛选、空状态、逐晚加价、对比、快照保存、刷新恢复、Escape 和 390px 无横向溢出均通过，无浏览器未捕获异常。

界面纠正后的检查增加：原首页与三个导航可见、无新旧版入口、会话切换后原筛选草稿保留。草稿预填由创建 helper 检查保留，不额外增加“准备材料草稿”产品入口。

本地结果：`.local/session-entry-result.json`；桌面截图 `.local/session-entry.png`，手机截图 `.local/session-entry-mobile.png`；干净安装日志 `.local/clean-install.log`。本地 profile、登录地址、凭据、私人文件及测试插件不进入分发包。自动验证结束时清理临时凭据；用户要求人工验收后已重新启动隔离服务并使用现有模型配置，服务保持可用。

## 审查与边界

- Standards 轴：发现独立 conversation 与共享 session scope 会让额外命令扩展提示投递到宿主编辑器；已移除本票不需要的命令、模型选择和权限预设扩展，并保持对应 UI 服务隔离，复审无剩余已证实问题。删减后的 tarball 已重跑全部集成。
- Spec 轴：按 issue 01 逐项核对，未发现遗漏的票内代码功能。模型成功路径已由真实调用补齐。
- 当前目录没有 Git 元数据，执行的是当前源码与规格审查，未伪称固定 Git 基线 diff 或创建提交。无 lint 配置；使用 TypeScript、esbuild 和 Node 语法检查。
- 工作台内模型切换、斜杠命令和权限审批交互未实现/验收；模型使用 DSH 已配置默认值。当前预设无业务工具，后续增加工具时需接入相应标准交互插件并验证作用域。未发送草稿仅保证当前页面生命周期内关闭/重开保留。
- 新版套餐接口当前只返回空集合，SNOW-02 才接业务数据。原 IndexedDB 台账及全部原导航直接保留，不迁移、不混入后续宿主数据源；原台账确定性计算检查保持通过。
- 没有 GitHub 远端安装验证，没有其他 DSH 版本、完整屏幕阅读器或跨浏览器兼容性承诺。

## 2026-09-23 侧栏交互补充

`test/session-resize.integration.mjs` 已验证拖拽、松手停止、键盘、宽度上下限与窄屏约束。`test/session-delete.integration.mjs` 已验证二次确认、取消、存储失败保留、当前会话移除后回首页、其他会话不受影响及刷新持久化。删除采用本浏览器列表移除语义：DSH 公开 sessions 契约无历史删除接口，原会话仍保留；不直接操作宿主日志文件。

## 2026-09-23 固定会话工作区

隐藏工作区选择，新增会话调用认证 Remote `snowTrip.ensureWorkspace`，由宿主 `homedir()` 定位 `~/dsh-snow-trip` 并递归创建目录，再通过公开 `workspaces.create({path})` 创建或复用注册。既有会话不迁移。`test/workspace.integration.mjs` 已验证原本不存在的目录被创建、两次新增会话 cwd 均为固定路径且仅注册一个工作区。构建、类型检查与现有自动检查通过。

## 2026-09-23 会话列表优化

保留原首页和导航，仅调整会话区：日期分组、标题搜索、空结果提示、当前项路标、行内删除、空白会话标题和时间显示。`test/session-entry.test.mjs` 检查真实标题优先、日期边界、排序及搜索；`test/session-list.integration.mjs` 实测搜索清空、Escape 不关闭工作台、当前项、删除二次确认和宽窄侧栏无横溢出。已检查 1440、750、390px 截图；构建、类型检查通过，自动检查 4 项通过、私人工作簿 1 项跳过。

## 2026-09-23 会话标题编辑

按验收反馈移除“助理会话”和数量，新增行内编辑按钮，通过 DSH 公开 `session.rename` 保存标题。`test/session-rename.integration.mjs` 已验证取消不保存、空标题校验、Enter 保存到宿主、刷新保留、按新标题搜索及 390px 无溢出，并检查截图。构建和类型检查通过；自动检查 5 项通过、私人工作簿 1 项跳过。验收服务已安装最新产物并保持运行。

## 2026-09-23 原生会话操作（替代本地列表删除）

此前仅检查 sessions 的删除能力，遗漏了 workspace-controller 的归档能力；上文“本浏览器列表移除”为旧实现，现已废止。行内菜单提供重命名、分叉、归档，分别使用公开 session.rename、sessions.fork 和 workspaces.archiveSession。列表订阅宿主 archivedSessionIds，不再读取 removedSessions，也不自动将旧隐藏记录归档。

`test/session-actions.integration.mjs` 已验证分叉保留历史、父子关系及雪季预设，重命名写回宿主、归档取消/确认、历史保留、独立浏览器同步和刷新持久化。只归档检查新建的分叉，不修改原会话。原本地删除测试由该检查替代。

## 2026-09-23 会话操作浮层

更多按钮使用原生 Popover 在按钮旁展开带图标的菜单，空间不足时向上展开并限制视口边界。`test/session-menu.integration.mjs` 验证位置、方向键/End、Esc 恢复焦点且不关闭工作台、外部点击收起、重命名及归档入口、390px 边界；截图已检查。构建、类型检查与自动检查通过。
