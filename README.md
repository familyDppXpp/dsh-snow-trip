# 雪季出行工作台

独立 DSH Web 插件。通过雪季助理录入文字套餐：多轮补充、查看已知信息和待确认项，在消息中的套餐确认卡片点击“确认保存”后落盘。支持未购买和不完整套餐。

## 使用

点击 DSH 左下角「雪季出行」进入原工作台，提供「找出行方案」「已存方案」。点击「开始录入」或「新增会话」，粘贴套餐说明。助理使用随包 `snow-import` 技能、`snow_query`、`snow_draft`、字段工具与 `snow_commit`。提交时展示 UI 确认卡片：新增按组展示已知信息与未知项，修改展示旧值与新值；内容改变必须重新确认；模型传入 `confirmed: true` 不能授权。

卡片分别显示购买状态、资料完整度、报价、实付、已付补款和未知项。未知不等于 0，未知列表不等于已确认没有。至少一项真实套餐信息即可保存；空白资料、负金额、无效日期或冲突信息会被拒绝。保存失败不产生成功卡片。

文字套餐保存在 DSH 已配置的本机存储后端，宿主只打开一个 `snow_trip` 数据域。预设仍名为 `snow-trip`；域名使用下划线是因为 DSH 不允许存储域名称包含连字符。「找出行方案」中的套餐卡片只读取宿主记录，不读取或迁移旧 IndexedDB。原工作台已有的台账和方案计算继续使用原浏览器存储，页面录入按钮统一进入文字会话；首页列表和统计使用同一份宿主套餐记录；旧 Excel 候选单独展示并保留原有计算与对比。文字套餐按已知日期和间夜提示限制，逐晚补款及总价暂不自动计算，未知金额不视为零。卡片上的“继续补全 / 补充信息”和方案的“继续规划”打开原会话，预填含名称及 ID 的提示词；已有草稿保留并追加，相同提示不重复追加，不自动发送。原会话已归档或不存在时提示不可用，由用户选择新建会话继续，不恢复归档。补全先查询最新版本，经确认更新原套餐 ID，版本递增；冲突须重新查询确认。文字录入链路尚不支持 Excel、图片、批量和自动规划。

确认与结果复用同一张卡片，保存中禁用按钮，成功后移除按钮；继续调整不写入，失败在卡片内展示原因。会话成功卡片从持久化工具 metadata 回放保存时的快照；概览读取宿主当前记录，二者使用同一 ID/revision。打开概览、切回概览和会话状态变化时重新读取。只提供 `snowTrip.listPackages/getPackage` 读取接口，不提供客户端写入接口。

使用 DSH 默认 JSON 存储配置时，套餐文件为 `$DSH_HOME/storages/snow_trip.json`；未设置 `DSH_HOME` 时通常位于 `~/.dsh/storages/snow_trip.json`。这是安装者自己的宿主数据，不写入插件安装目录或 Agent 工作目录。下文仓库内 `.local/session-entry-home` 仅为本机隔离测试环境，已被 Git 忽略，也不在插件打包文件清单内。

出行方案闭环：`snow_prepare_plan` 合并确认条件、套餐范围和按数量/单价表达的共同费用，持久化规划 ID。`snow_evaluate` 每次核算一份完整候选，工具读取确认条件，独立线程执行模型脚本并校验日期覆盖、版本、有效期、禁用日期、剩余间夜、不可拆分、成本加总和预算。规划金额统一为整数分，查询套餐仍返回元。基础套餐成本由工具按使用间夜分摊，脚本提供逐日新增补款及权益覆盖数量；核算通过后才产生结果 ID。`snow_plan_results` 读取进度与结果；`snow_plan_stage` 只引用结果 ID 展示、讨论和逐份保存，不能传入任意结果金额。`snow_save_plan` 同样只接受结果 ID，并经用户卡片确认。修改条件创建新规划，旧结果保留但失效；技术错误可修正后不限次重试，业务不合格淘汰，保存失败不自动重试。工作台“已存方案”读取服务端快照，支持继续调整，原方案不覆盖。卡片底部可删除方案，二次确认后永久删除，保留关联套餐及聊天中的历史卡片；删除后会话不再关联任何套餐或方案时自动归档。旧浏览器方案的读取、展示、计数、保存和导出已废弃，不迁移或清除已有本地数据。

会话按已存方案优先、套餐其次、其他兜底分组；出行方案会话显示方案数量。会话右侧可切换关联套餐与方案，方案引用套餐默认查看保存时快照，可切换最新资料或返回方案，不切换会话。删除套餐时会一并删除引用该套餐的已存方案，确认框列出方案名称；提交时服务端重新核对影响范围，变化后必须重新确认。历史聊天中的快照保留。关联套餐或已存方案的会话不能从列表手动归档，必须在页面删除资料；删除最后一个套餐或方案后自动归档，会话仍关联其他资料时不归档。

会话列表支持搜索、重命名、分叉和归档，新增会话自动使用 `~/dsh-snow-trip`。新会话保持空白，不自动发送；关闭工作台不取消执行。会话、附件和套餐保存在本机，助理将任务相关内容发送给 DSH 配置的模型。未发送草稿不保证刷新后恢复。

查询支持 ID、关键词与分页，返回 `total/truncated/nextOffset`。每页 `limit` 为 1–50（默认 20），读取全部套餐需按 `nextOffset` 分页。方案卡片在服务端与客户端共用负载校验，对六个阶段的数字、布尔值及嵌套列表统一校验，兼容已发出请求的 `item` 包装；无法解析的历史待回答请求显示可恢复错误卡，不回退原始 JSON。估算金额按分传输、按元编辑，推荐卡回传用户实际勾选的方案索引；不合法的新负载在展示前返回工具错误。购买平台使用 `purchasePlatform` 记录，例如“微信小程序 xxx”；未知为 null。不再采集或校验 `sources` 消息引用，旧记录兼容读取。

## 本地安装

需要 Node.js >=22.19、pnpm 与带 Web 客户端的 DSH。本目录先安装依赖构建：

```sh
pnpm install
dsh plugin --profile web add /绝对路径/huaxue
dsh web
```

使用源码版时，在 DSH 源码根目录执行对应的 `pnpm dsh plugin --profile web add /绝对路径/huaxue` 和 `pnpm dsh web`。不需要复制应用启动器，不需要手写 dependencies / bundles。

本任务在 `.local/session-entry-home` 隔离 profile 验证，没有修改真实用户 profile。本机可重新打开验证页面：

```sh
cd /Users/liuyunxia/Documents/ai/deepseek-harness
DSH_HOME=/Users/liuyunxia/Documents/dsh/huaxue/.local/session-entry-home pnpm dsh --profile web --host 127.0.0.1 --port 4330
```

在宿主地址添加 `?app=snow-trip` 可自动打开工作台，例如 `http://127.0.0.1:4330/?app=snow-trip`；刷新后仍会自动打开，关闭工作台可返回 DSH。

以上绝对路径仅供本机运行，插件源码和独立构建不依赖这些路径。隔离验证环境的临时凭据在验证后清理，使用前需配置有效模型；私人文件和订单数据不在分发包内。

## Git 分发

尚未提供远端地址；以下占位命令在推送后替换为仓库地址与完整提交号：

```sh
dsh plugin --profile web add github:OWNER/REPOSITORY#FULL_COMMIT_SHA
dsh web
```

Git 安装的 `prepare` 从本包源码生成客户端、Host 服务和 Typert Remote 描述。pnpm 可能阻止执行：按当次报错，在目标 profile 的 `pnpm-workspace.yaml` 中合并 `allowBuilds`，只允许目标包及固定提交，然后重试。精确键可能包括完整 Git URL 和 SHA，SSH 与 HTTPS 键也可能不同；不要将普通包名授权当成通用步骤，不关闭全局限制，保留原有配置。

本包内部只允许固定 `esbuild@0.25.12` 构建脚本。构建工具在 devDependencies 和锁文件中。浏览器共享宿主 React，没有另一份 Cordis。SheetJS 来自[官方发布地址](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)，打入客户端，不在运行时加载 CDN。

也可安装预构建包：

```sh
pnpm pack
dsh plugin --profile web add ./dsh-snow-trip-0.1.0.tgz
```

## 开发验证

```sh
pnpm build
pnpm test
pnpm typecheck
# 针对当前版本台账的可选回归；不要把私人文件提交进仓库
SNOW_TEST_WORKBOOK=/绝对路径/2627雪季套餐台账.xlsx pnpm test
```

界面使用 JavaScript，Remote 服务使用 TypeScript；构建使用锁定版本的公开 DSH Typert SDK，不依赖宿主源码目录。核心检查覆盖日期边界、跨日加价、未知费用、不可用期、重叠规则、重复编号、客户端产物和 React 共享。真实文件断言是当前数据基准，数据更新后需对应调整。

实际验证见 [VERIFICATION.md](VERIFICATION.md)，兼容性仅覆盖记录中的 DSH 版本。

真实集成检查需先在**隔离** Web profile 安装本包产物和 `test/integration-host` 测试插件，配置有效模型并启动宿主：

```sh
SNOW_DSH_URL='宿主显示的登录地址' SNOW_REAL_MODEL=1 node test/session-entry.integration.mjs
```

需要本机可用的 Playwright；可用 `SNOW_PLAYWRIGHT` 指定其模块路径，`SNOW_CHROME` 指定 Chrome。`SNOW_HOST_LOG` 可替代登录地址，脚本不打印登录凭据。可选 `SNOW_PRESET_FILE` 指向隔离安装包的 `presets/snow-trip/agent.cordis.yml`，测试会临时改名并在 finally 恢复，验证真实预设失败。测试插件不进入分发包。

## 预设技能扩展

`src/service.ts` 在宿主层单实例管理存储与工作台读取接口；`src/tools.ts` 通过包子路径 `dsh-snow-trip/tools` 在雪季预设中装配，注册查询、草稿、字段修改与提交工具。普通预设不获得这些业务工具。保存确认在工具内完成，服务端保存方法不暴露为 Remote 接口。

雪季预设设置 `includeDefaultRoots: false`，仅扫描随预设分发的技能目录，不扫描用户级或工作区内的默认技能目录。工作台新建会话使用宿主用户目录下的 `dsh-snow-trip` 工作区，多个会话共享该目录；重新打开历史会话保留原工作区。

雪季技能位于 `presets/snow-trip/skills/<技能名>/SKILL.md`，使用 `name` 和 `description` YAML 元信息。预设的 `agent.cordis.yml` 与官方 Cordis 预设一样装配 `@deepseek-ai/dsh-skill-filesystem` 和 `@deepseek-ai/dsh-tool-skill`，通过 `baseUrl` 解析当前预设的技能目录。新增技能只需新增目录与文件，不修改 `SnowTrip` 服务或维护逐个注册清单。`package.json` 的 `files` 已包含整个 `presets` 目录。

用安装环境中的官方扫描器验证可搬迁与多技能发现：

```sh
SNOW_SKILL_FILESYSTEM=/安装位置/skill-filesystem/lib/index.js node test/skills.integration.mjs
```

套餐权益独立展示雪票张数、早餐人数、汤泉人数及次数，以及是否可拆分。每项权益分别记录是否包含、整单/每晚/每日/其他数量口径与条件说明；未知不当作不包含，也不自动折算总数。使用 `snow_set_benefits` 更新草稿，拆分条件继续使用 `splitRule`。历史记录的新字段默认未知，不自动从旧说明推断事实。

会话右侧套餐与方案标题的“···”菜单支持“添加到会话”：使用原生输入框引用标签，可逐项添加多个套餐/方案，同类型同 ID 去重，标签可用退格键删除。标签随下一条消息发送，不自动发送；成功后由宿主清空，失败保留。模型仅收到类型与 ID，套餐用 `snow_query` 查询最新资料，方案用 `snow_query_plan` 只读查询原 ID 对应的已存记录；从套餐快照添加也查询最新套餐，不携带旧版本正文。
