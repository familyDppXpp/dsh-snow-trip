# SNOW-01 验证记录

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
