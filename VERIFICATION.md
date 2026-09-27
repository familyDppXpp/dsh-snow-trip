# SNOW-01 验证记录

## DSH 0.1.7-rc.2 兼容验证（2026-09-25）

当前插件适配官方 DSH `0.1.7-rc.2`、Cordis `4.0.4`。本地宿主已合入官方 `477b4f420553e8a52c2fbccc464d7561b239c443` 并完成 Host、Client、Web 构建。下面较早日期的记录仅描述当时版本。

- SDK 和 peers 固定到新版；声明式 `dsh-agent-preset` 替代已删除的目录加载器，保留宿主默认预设。技能通过插件包位置解析，可搬迁安装。
- 工作台使用 `sessions.retain/using`、`SessionProvider` 和 `conversation.content` 工厂；会话选择由工作台持有，运行状态和待确认问题读取 `uiSession.sessionStatus`。快捷键服务在工作台隔离，避免重复注册。
- 删除依赖本地宿主定制的 `turnNavigationHideWidth` 补丁；插件不再要求修改官方宿主。
- 独立临时目录安装公开依赖并运行 `prepare` 成功；插件构建、类型检查、65 项测试中 63 项通过，2 项私有 Excel 素材测试按条件跳过。
- 分发包清单包含 Host/Client/Remote 入口、全部被引用的类型声明和两项技能，排除测试数据与凭据；tarball 经 DSH CLI 安装并重启后，基础浏览器及已保存套餐读取检查通过。
- 在 `.local/dsh-017-compat` 隔离 Web profile 实测预设、认证 Remote 读取、新建会话、两个技能的斜杠菜单、关闭重开后的草稿保留。
- 按用户指定从 `.local/session-entry-home/settings.yaml` 取 `minimax-cn / MiniMax-M3` 配置，仅复制该提供商的凭据引用。真实模型完成技能调用、套餐草稿和保存确认；确认前记录数不变，确认后新增记录的报价为 129900 分、购买状态为 `unpurchased`、revision 为 1。清除日期筛选后首页显示，刷新 Remote 仍读到同一 ID/revision。
- 没有使用其他模型，没有迁移原 DSH_HOME 的会话或套餐数据。当前完整方案计算/保存逻辑经过自动测试；本次真实模型验证覆盖套餐录入保存，未重跑图片识别和完整出行规划。

可复现浏览器检查（需在隔离 profile 安装 `test/integration-host`，配置上述模型并启动宿主）：

```sh
SNOW_HOST_LOG=/绝对路径/宿主日志 SNOW_REAL_MODEL=1 \
SNOW_PLAYWRIGHT=/绝对路径/playwright/index.mjs \
SNOW_CHROME=/绝对路径/Chrome node test/host-compat.browser.mjs
```

不设置 `SNOW_REAL_MODEL` 时只验证不发送消息的基础交互。已有真实模型记录可用 `SNOW_VERIFY_SAVED=<套餐ID>` 单独复验首页和刷新读取，不再调用模型。

## 本地 Excel 回归素材（2026-09-23）

完整原件位于 `.local/2627雪季套餐台账.xlsx`，与用户提供的原件逐字节一致。小样本位于 `outputs/excel-regression-20260923/2627雪季套餐台账-小样本.xlsx`，只保留 003、007、008 三个套餐及选定规则，移除截图并压紧行号；共 9 晚，含额外补款实付 7344 元。小样本用于回归，不代表完整可用日期规则；两份 Excel 均由 Git 忽略。

覆盖已付补款、已预约状态、周末加价、跨日期档位、未知加价不归零、拆分使用、套餐总价不误作加价及节假日不可用。以下命令在项目根目录执行：

```sh
SNOW_TEST_WORKBOOK=.local/2627雪季套餐台账.xlsx \
SNOW_TEST_SMALL_WORKBOOK=outputs/excel-regression-20260923/2627雪季套餐台账-小样本.xlsx \
pnpm test
```

结果：11 项全部通过，无跳过。不提供对应环境变量时，私有 Excel 测试自动跳过。

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

## SNOW-02 文字录入（2026-09-23）

本次以 `55a211d` 为基线，交付文字单条新增、宿主查询、确认与只读卡片；不涉及 Excel、图片、批量、编辑或规划。

- `pnpm build`、`pnpm typecheck`、`pnpm test` 通过。10 项检查中 9 项通过，1 项私人 Excel 回归因未提供文件而跳过；仓库没有 lint 脚本，另执行 `git diff --check`。
- `test/text-import.integration.test.mjs` 通过真实 DSH Tools 调度、DomainFacility 与 JSON 临时存储验证确认→写入→关闭→重开→查询。覆盖未确认、伪造 confirmed、内容改变重新确认、金额/日期/空白/使用冲突、取消、查询分页截断。故意把目标 JSON 文件位置替换为目录使落盘失败，确认无 metadata、内存记录数不变。
- 来源只接受当前会话 `source.kind=user` 的文字，排除宿主运行上下文注入；自报来源序号及摘录必须匹配真实消息。最近 30 条、每条 4000 字的边界通过 `messagesTruncated` 告知查询调用方。
- `test/text-import.browser.mjs` 在隔离 DSH `0.1.5-alpha.1-5dda764-dirty` 与 Chrome 上通过：预先存在旧 IndexedDB 记录时不混入概览；在真实会话发送合成材料；确认前无新增记录；工作台内完成宿主确认；工具结果卡片与概览 ID/revision 相同；刷新后历史 metadata 卡片可回放；无浏览器异常。DSH 将完成后的工具步骤折叠，展开“1 次工具调用”查看卡片。
- 浏览器使用本机确定性 OpenAI 兼容模型响应，验证宿主真实会话、工具调度、交互与持久化链路，不代表已验证真实模型对任意文字的理解质量，也未测试本票范围外的 Excel/图片能力。
- 截图保留在本机 `.local/text-import-confirm.png`、`.local/text-import-saved.png`、`.local/text-import-overview.png`，不随包发布。
- 非法、旧版、错误工具 metadata 的客户端检查通过，回退为可展开的通用工具结果，不生成成功卡片。
- 两轴代码审查完成：规范轴无遗留问题；需求轴发现“仅实付等信息被当成空白”，已修复并加入回归。

规格差异：DSH 的 `UNIT_NAME_RE = /^[a-z][a-z0-9_]*$/` 不接受 `snow-trip`，因此实际唯一存储域使用 `snow_trip`，表名 `packages`；预设仍为 `snow-trip`。使用配置好的宿主本机后端，没有自建数据库或云服务。

新增分发资源：`presets/snow-trip/skills/snow-import/SKILL.md`、宿主编译产物中的输入校验/工具/存储模块、`lib/types/packages.d.ts` 及 `./types` 导出、新版客户端卡片和生成的 `getPackage/listPackages` Remote；宿主 SDK 使用 peerDependencies。包内不包含测试、私有素材、临时凭据或本机路径。

复现核心检查：

```sh
pnpm build
pnpm typecheck
pnpm test
```

浏览器检查先准备隔离 Web profile，安装本包与 `test/integration-host`，配置测试模型指向本机 mock server。DSH 仓库提供 `pnpm run mock:llm`：`--port 4342 --sequence tool_call_success,success --repeat-last --tool-name snow_save_packages --tool-arguments '{"package":{"description":"长白山住宿","quote":129900,"purchaseStatus":"unpurchased"}}'`。每次检查重启 mock，避免上一轮耗尽首条工具响应。测试模型仅用合成材料，供应商 API key 环境变量填测试值。

```sh
SNOW_HOST_LOG=/绝对路径/隔离宿主日志 \
SNOW_PLAYWRIGHT=/绝对路径/playwright/index.mjs \
SNOW_CHROME=/绝对路径/Chrome \
node test/text-import.browser.mjs
```

分发复验：`pnpm pack` 后通过 DSH `plugin --profile web add` 安装 tgz 到隔离 profile，重启宿主并重新运行上述浏览器全链路，结果通过。安装器提示 SDK peer 缺失：这些是由 DSH 宿主解析器提供的共享包，隔离 profile 的包管理器未单独安装；已用安装后的真实宿主验证其加载、工具调用与 Remote 正常，不将该安装提示描述为零警告。

## SNOW-05 截图与文字录入（2026-09-23）

基线 `e226b29974b319b7e15e7e2c90e1e177a0338128`。已接入“导入截图”：选择 PNG/JPEG/WebP/GIF 后新建雪季会话，复用宿主附件草稿与缩略图、预填可编辑提示词，不自动发送。原图使用同一宿主 URL 在工作台内的原生弹窗展示，解决宿主 body portal 灯箱被工作台外层 dialog 遮挡的问题；没有另一套附件存储。

`sourceNotes` 区分图片事实、用户补充、未确认推断，确认摘要、持久化记录及两处卡片共用该字段。旧记录缺少此字段时读为 `[]`；原 `sources` 历史兼容行为不变。来源说明由助理整理并交用户确认，不代表系统独立证明识别正确。图文多轮合并、冲突追问、模糊项保留未知由 `snow-import` 指导，图片能力错误沿用宿主，并在工作台显示实际发送错误及切换模型／补充文字路径。

验证结果：

- `npm run build`、`npm run typecheck`、`npm test`、`git diff --check` 通过；15 项自动检查中 13 项通过，2 项私人工作簿检查未提供输入而跳过。仓库没有 lint 脚本。
- `test/image-import.test.mjs` 覆盖不自动发送、附件添加失败释放、类型拒绝、图文来源摘要、未知和冲突问题、非法来源输入。
- 复用 `test/text-import.integration.test.mjs` 的真实宿主 Tools 与存储检查，增加图文来源在确认、写入、重开、查询、更新保留中的断言，未复制一套持久化测试。
- `test/image-import.browser.mjs` 在隔离 DSH `0.1.5-alpha.1-5dda764-dirty` 和 Chrome 上通过：合成截图缩略图与原图弹窗、草稿可改、发送前模型请求为零且台账不变；发送后真实宿主请求包含 PNG 的 `image_url`；追加文字后确认摘要包含图片事实、用户补充和 3 晚；用户确认后成功卡片与概览 ID 相同。
- 配置仅文字测试模型后，宿主实际拒绝图片发送；工作台显示“当前模型不支持图片”，套餐数量不变，`/model` 可切回兼容测试模型。全部浏览器步骤无未捕获异常。
- 浏览器使用本机可控 OpenAI 兼容响应，验证附件、会话、错误处理与保存链路；它不证明真实模型的图片理解、模糊文字判断或冲突处理质量。
- **真实兼容模型识图：未验证。** 当前隔离环境没有已确认可用的真实图片模型凭据；已有真实模型配置未证明图片支持。没有将可控模型结果记为真实识图成功，此项验收保留待验证。
- 规范轴和需求轴独立审查完成，无剩余已确认缺陷。附件草稿方法来自当前宿主导出的 `ConversationController`，尚不在 `IConversation` 类型接口中，兼容性仅覆盖上述验证版本。

本地图片 `.local/合成套餐.png`、`.local/image-draft.png`、`.local/image-confirm.png`、`.local/image-unsupported.png` 均为合成测试材料，不随包分发。测试使用 `.local/image-import-home`，没有改用户默认 profile。分发复验使用独立命名 tgz，避免同名文件安装缓存；安装器仍有宿主 SDK peer 提示，真实加载和执行已通过。

浏览器复现：先在隔离 profile 安装本包与 `test/integration-host`；配置 `snow-test` 提供商指向 `http://127.0.0.1:4342/v1`，模型 `snow-test` 的 `input` 为 `[text, image]`、`snow-text` 为 `[text]`，显示名称分别为“雪季确定性集成检查”和“仅文字测试模型”。宿主启动时设置 `SNOW_MOCK_API_KEY=test`。脚本自行启动并关闭本机可控模型。

```sh
SNOW_PLAYWRIGHT=/绝对路径/playwright/index.mjs \
SNOW_MOCK_SERVER=/绝对路径/deepseek-harness/packages/test-support/llm-mock-server/lib/index.js \
SNOW_HOST_LOG=/绝对路径/隔离宿主日志 \
SNOW_CHROME=/绝对路径/Chrome \
node test/image-import.browser.mjs
```


### SNOW-05 验收纠正

按用户既有要求移除误加回的“资料来源”卡片折叠区，会话成功卡片和概览共用组件，统一移除。来源数据与保存确认摘要保留，用于图文核对；卡片不重复展示。浏览器回归断言同步检查该折叠区不存在。


### 来源参数撤回

用户确认工具来源参数此前已删除，本次新增 `sourceNotes` 属于误恢复，现一并撤回：公开工具参数、业务输入、保存摘要与技能传参要求均移除来源字段。图文差异只在会话解释中表达。旧记录读取时兼容并丢弃 `sources`/`sourceNotes`，避免已有套餐无法打开，不继续返回或写入。输入与宿主工具回归检查拒绝来源参数。此前来源字段的实现和验证描述仅为历史记录，不再代表当前行为。

### 入口精简

按验收反馈移除“套餐与来源”重复导航页，以及顶部“导入截图”按钮。套餐在“找出行方案”查看；图片通过会话输入框的宿主附件按钮添加，不再创建图片专用会话或预填图片提示词。图片浏览器回归同步使用宿主附件入口。


## 消息内套餐确认与结果卡片

沿用草稿和字段工具，在 `snow_commit` 加入宿主确认交互。消息中的同一张 UI 卡片展示新增分组摘要或修改差异，确认后禁用按钮并切换保存结果；继续调整不写入也不作为错误。版本检查和域表原子更新保留，结果 metadata 保存本次预览和旧值，历史回放不读取当前套餐。待确认卡片通过宿主 composer 扩展点固定在底部交互区；结果通过 turnTail 扩展点放在本轮末尾，不插入用户旧消息。长内容在卡片内部滚动，操作按钮保持可见。

验证：构建通过；`pnpm test` 14 项通过、2 项私人工作簿检查跳过。工具集成检查覆盖继续调整不写入、确认期间版本冲突、保存期间拒绝改动、落盘失败和幂等重试。`test/save-card.browser.mjs` 用合成数据验证确认、保存中禁用、成功、继续调整、错误、清空标记和 390px 布局。

另在 `.local/save-flow-home` 隔离宿主与确定性模型完成真实会话新增、修改、确认前不落盘、单卡片切换、版本递增及刷新历史回放检查，无页面异常；未调用真实模型或修改用户套餐。日常服务仍为 4330。


## 套餐权益字段

新增雪票、早餐、汤泉的包含状态、数量、口径与条件说明，以及可拆分状态；复用已有拆分说明。确认卡片、更新差异、结果卡片、概览和套餐侧栏使用同一套字段。旧数据读取时补充未知字段并重算待补全项，不改写存储中的业务事实。

`test/benefits.test.mjs` 覆盖数量口径、明确不包含、其他口径缺说明、非法数量和旧数据；公开工具集成检查覆盖权益字段设置、保存与重开。构建与 15 项自动检查通过，2 项私人工作簿检查跳过；浏览器合成数据检查验证雪票每晚、早餐每日、汤泉整单人数/次数、拆分说明及长卡片布局。

## SNOW-06 出行方案闭环 · 第一阶段（2026-09-24）

规格修订：移除独立的 Jev 决策模型，会话 LLM 驱动整个搭配过程的业务判断；原 Jev 独立审核改为 `snow-plan` 技能提示词中的自查要求。临时脚本核算保留：LLM 按套餐原文临时编写脚本并实际执行，不以心算替代。详见 `.scratch/product-agent/issues/06-evaluate.md` 的 2026-09-24 修订段。

实现：

- `src/plans.ts`：方案输入（金额单位元）与持久化记录（金额单位分）schema、`planRecord` 交叉校验（快照与搭配版本一致、逐日费用引用搭配内套餐）、`snow_evaluate`/`snow_save_plan` 卡片 metadata 解析。
- `src/service.ts`：`snow_trip` 数据域加入 `plans` 表；服务端 `savePlan` 在写入队列内重新核查套餐版本；`listPlans/getPlan` 只读 Remote。
- `src/tools.ts`：`snow_evaluate` 统一校验版本与 `completeness === 'complete'`，返回套餐原文快照与受限脚本数据（纯 JSON、无函数、无宿主访问）；`snow_save_plan` 保存前重新核查版本与资料状态，多选逐份调用。两个工具经 `presentationMeta` 持久化卡片快照，历史回放不读当前套餐。
- `presets/snow-trip/skills/snow-plan/SKILL.md`：决策约束（覆盖完整候选空间、不静默截断、默认优先级排序、脚本自查、失败不降级不重试）；`agent.cordis.yml` 提示词同步。
- 客户端：`snow_evaluate` 核算卡片、`snow_save_plan` 保存卡片，非法或旧版 metadata 回退通用工具结果。

验证：`pnpm typecheck`、`pnpm build`、`pnpm test` 通过（21 项通过，2 项私人工作簿检查跳过）；`git diff --check` 干净；`pnpm pack` 产物含 `./plan-types` 导出与技能目录。`test/plan-tools.integration.test.mjs` 覆盖：版本过期与不存在套餐拒绝、资料未完成拦截、合法搭配返回沙箱与持久化 metadata、保存版本冲突拒绝、非法金额与逐日引用校验、存储重开可读取。真实模型端到端（对话表达需求→生成→保存→回顾）未运行，保留待验收。

### SNOW-06 阶段卡片补齐（2026-09-24 晚）

用户验收发现方案卡片未按原型实现（原型 `prototype/plan-loop` 的七类卡片在产品里一个都没有），本轮补齐交互层：

- 新增 `snow_plan_stage` 工具：LLM 一次调用呈现一张阶段卡（confirm/estimate/results/discussion/review/status）并等待用户操作；卡片渲染在客户端 `src/plan-question-card.jsx`，走宿主 `ask_user_question` 卡片链路（composer + 工作台镜像），与 `snow_commit` 确认卡同通道。
- 卡片内容：条件确认（选填表单、建议日期/晚数标注、套餐推荐预勾、更多套餐折叠、交通餐饮估算折叠、唯一主动作"生成方案"）；估算确认（分项金额可改、估算与用户事实分列）；结果选择（勾选、优先推荐/备选徽标、整趟总价、每日费用表、跨天共同费用单列、分摊依据、约束检查、统一操作栏"继续讨论/保存所选（N）"）；讨论比较（零/单/多选三态，多选对比表）；回顾快照（保存时费用+继续调整，原方案不覆盖）；状态卡（版本变化/空结果/失败+入口）。用户仍可自由输入；零选择不阻塞。
- 回答协议：编辑负载经 custom JSON（{values,ids,estimates}）回传，快捷动作经 selected 标签；跳过回传空 selected。工具原样交回 LLM 决策，不做业务改写。
- `snow_plan_stage` 的问题 id（snow-plan-<stage>-<key>）与 detail 负载自洽校验：伪造或不一致的问题回退普通问题渲染，不显示业务卡片。
- 删除过程中产生的未使用草稿 `src/plan-cards.jsx`、`src/plan-context.js`（与 plan-question-card 重复，code-review 自查发现后移除）。

验证：`pnpm typecheck`、`pnpm build`、`pnpm test` 通过（30 项通过、2 项私人工作簿检查跳过）；`test/plan-cards.test.mjs` 用宿主 React SSR 检查五张卡的标记结构（表单/徽标/费用表/操作栏/三态/回退）；`test/plan-question.test.mjs` 覆盖负载解析与伪造拒绝；`test/plan-stage.integration.test.mjs` 经真实宿主 Tools 验证编辑回传、按钮选择、跳过与取消。真实模型端到端（卡片出现在真实会话、用户在卡上完成选择到保存闭环）待验收。


## 2026-09-25：plan 全阶段卡片排查

- 原复现：估算 `nights` 为字符串且费用错放在 `suggested.item` / 根 `item`；推荐、讨论的 selected 字符串与回顾的嵌套列表同样可能失败。合成负载在修复前产生 10 个失败检查。
- 覆盖 confirm / estimate / results / discussion / review / status 的传输解析、实际组件渲染与服务端请求；覆盖持久化快照 null、错误卡恢复、分/元换算、真实勾选与零选讨论。
- 浏览器合成页验证：300.25 元回传 30025 分；失败保留编辑值且不自动重试；成功禁用重复提交；零选禁用保存但可继续讨论。
- 可复查：`node --test test/plan-question.test.mjs test/plan-cards.test.mjs test/plan-stage.integration.test.mjs`。交互页：`node test/plan-card-fixture.mjs` 后用本地静态服务器打开 `.local/plan-card-check/index.html`（仅合成数据，依赖已有 React DOM，可通过 SNOW_REACT_DOM 指定）。
- 本检查不等于 SNOW-06 全票验收：模型是否始终使用阶段卡、自动执行的生命周期与历史阶段卡回放、整套规划/保存业务闭环仍需单独场景验收。

## 2026-09-25：估算卡 UI 优化

费用改为逐行清单，依据与金额分栏；长内容在卡片内滚动，主操作位于滚动区外，补充说明按需展开。构建与 16 项卡片检查通过；在 320 / 768 / 1024 / 1440 像素宽度检查无横向溢出，并验证展开补充说明后的键盘焦点。当前真实会话显示新布局，未提交估算或改动费用。


## 规划工具与流程重构（2026-09-25）

- 用户确认后实施：合并确认、规划 ID、一次一份完整候选、结果 ID 引用、整趟总成本为核心、技术错误不限次修正、旧结果保留但不能用于新条件。
- 新增 `planning.ts`（确定性规则与结果校验）、`planning-tools.ts`（结构化工具与独立线程脚本执行）。规划、核算结果和保存快照均在服务端数据域持久化；旧套餐与方案表保留。
- 公开 Tools 集成检查覆盖：合并确认修改单价与预算、跳过估算确认被拒绝、数字类型与精确路径、脚本错误、错误总价不产生结果、日期连续/禁用日/有效期/剩余间夜/不可拆分、权益覆盖数量、整数尾差、超预算、ID 保存幂等、条件和套餐版本变化、停止异步脚本保留已有结果、存储重开读取。
- 浏览器合成确认页：单价 300.25 元回传 30025 分，生成方案动作只提交一次。旧历史卡片解析继续兼容，新业务入口禁止任意 detail.results。
- 完整测试：51 项，49 通过、2 项私人工作簿检查跳过；构建和类型检查通过。真实模型是否穷尽候选、正确解释每一条自然语言权益规则仍取决于模型，未将合成检查描述为真实用户旅行费用已核算。


2026-09-25：预设启用宿主 `@deepseek-ai/dsh-tool-ask-user`。必要条件缺失先通过问题卡澄清，禁止创建占位规划后再用长段文字追问；估算接受、结果与保存仍由业务卡处理。通过 CLI 实际模块解析器加载工具，并用宿主 Tools 执行合成问题，验证选项回答完整回传。

## HOME-01：首页月历（2026-09-27）

- 默认首页、桌面与移动品牌返回、本地当月、周一开头、年月导航、按日方案/套餐/日期待确认分组已实现。日期计算独立于原筛选，复用 `ledger.js` 与 DayPicker；首页状态保留在组件中，离开时移除内容，避免重复详情卡片。
- 复用宿主套餐/方案读取、已有套餐详情和会话路径；套餐刷新跟随所有雪季会话的更新时间与执行状态。未发送会话提供返回入口，打开首页不创建或停止会话。
- `pnpm typecheck`、`pnpm build`、`git diff --check` 通过；仓库未配置单独 lint 命令。`pnpm test`：88 项，86 通过、2 项私有 Excel 素材相关跳过，无失败。
- 新增 `test/home-calendar.test.mjs`：A/B/C 跨年、有效期首尾、禁用日、null/空数组、已知耗尽/作废与未知使用量、按 ID 去重、闰日、分段并集、真实宿主保存/修改/级联删除后的聚合与历史快照。
- 新增 `test/home-calendar.browser.mjs`：自动创建临时 DSH profile，使用真实 App、宿主 JSON 存储和认证 Remote；不调用模型，不读取用户业务数据。覆盖首次/重开首页、日期明细、原详情/会话入口、未发送草稿、年月与键盘、390px、两类数据独立加载/失败/重试、级联删除、迟到响应和空库。错误/延迟在真实 HTTP 响应边界注入，未替换内部 actions 或日期计算。
- `test/plan-filter.browser.mjs` 与 `test/package-explore.browser.mjs` 均通过。套餐浏览器测试原有排序基线失败已修复：默认断言与标签按“累计已支付降序”更新，晚数排序改为显式选择后检查；样例包含零金额、未知金额，以及本价较低但加上补款后累计金额更高的套餐，验证两种排序、升降序、刷新默认值、组合筛选、键盘和 390px 窄屏。产品排序逻辑未改动。
- `test/host-compat.browser.mjs` 的恢复步骤已改为先验证首页、再主动返回未发送会话，保留草稿断言；同一路径已在新隔离宿主回归中执行。旧脚本整体未单独重跑。
- 两轴代码审查：规范轴无发现；需求轴指出会话恢复测试需适配，已修复并定向复核。既有工作区修改保留；没有提交、远端发布或部署。地图不属于 HOME-01。

复现首页浏览器检查（使用本机已有依赖；CLI 为 DSH 0.1.7-rc.2 的 `lib/bin.js`）：

```sh
pnpm build
SNOW_DSH_CLI=/绝对路径/dsh/apps/cli/lib/bin.js \
SNOW_PLAYWRIGHT=/绝对路径/playwright/index.mjs \
SNOW_CHROME=/绝对路径/Chrome \
node test/home-calendar.browser.mjs
```

检查后自动清理临时宿主；截图位于 `.local/home-calendar/desktop.png` 与 `.local/home-calendar/mobile.png`。不设置 `SNOW_CHROME` 时使用 Playwright 已安装的浏览器。

## 首页改为四个月雪季总览（2026-09-27，用户最新要求）

- 本节替代 HOME-01 的单月默认视图和日期明细卡片要求：固定展示十二月至次年三月，支持雪季切换；桌面四列、窄屏两列。首页只显示日历色带、去重统计和选中日期数量，不渲染套餐或方案明细卡片。
- 使用 Taste 设计指导，调整标题区、排版、留白、日期连续色带及轻量进入动画，遵循减少动态效果设置；保留深色模式、键盘操作和分类加载/重试。
- 日期检查新增雪季归属、跨年四个月、闰日和统计去重。全量测试 89 项：87 通过，2 项私有 Excel 素材检查跳过；类型检查与构建通过。
- 真实隔离宿主浏览器回归通过：1507×858 四个月完整同屏、图层与雪季切换、无明细卡片、390px 双列、草稿恢复、两类数据加载/失败/重试、级联删除、迟到响应和空库。原套餐排序与方案筛选浏览器回归通过。
- 本机验收地址仍为 http://127.0.0.1:4348/，使用隔离预览资料；当前用户浏览器已刷新至新首页。未提交或部署。

## 固定雪季与叠加日历交互（2026-09-27，最新反馈）

- 固定 2026 年 12 月至 2027 年 3 月，移除雪季切换与行程/套餐 Tab；行程色带、蓝色套餐短线和琥珀色待确认圆点同时呈现。
- 四类图例可多选；全不选和全选均展示全部，部分选中仅展示对应类型，浮层和月份行程数跟随筛选。全年汇总保持原数据口径。
- 移除右下角选中日期概况，悬停或键盘聚焦直接展示日期对应的行程与套餐名称；Esc 关闭浮层，触屏点按可查看。
- 全量测试 90 项，88 通过、2 项私有素材跳过；类型检查、构建和真实宿主浏览器回归通过，包含叠加标记、部分/全选/空选、悬停详情、Esc、移动端与既有读取/草稿/删除路径。


## 可选月份区间（用户确认后实施）

- 复用现有筛选弹出面板，按月点选起止区间，确认后生效；限定 2026 年 1 月至 2027 年 12 月，支持同月与反向选择，取消不应用草稿。
- 首次默认 2026 年 12 月至 2027 年 3 月，通过现有 IndexedDB 保存选择；读取失败使用默认值并提示，写入失败保留当前视图并提示。
- 日历桌面四列、窄屏两列自动换行，统计覆盖所选完整月份并按记录去重；保留图例筛选与悬停详情。
- 构建、类型检查通过；全量 90 项测试中 88 通过、2 项私有素材检查跳过。真实隔离宿主浏览器检查通过，新增单月统计、跨年反向选择、24 个月、刷新记忆及默认区间恢复。
