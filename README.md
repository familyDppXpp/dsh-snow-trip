# 雪季出行工作台

独立 DSH Web 插件。通过雪季助理录入文字套餐：多轮补充、查看已知信息和待确认项，在 DSH 确认控件中选择“确认保存”并提交后落盘。支持未购买和不完整套餐。

## 使用

点击 DSH 左下角「雪季出行」进入原工作台，保留「找出行方案」「已存方案」「套餐与来源」。点击「开始录入」或「新增会话」，粘贴套餐说明。助理使用随包 `snow-import` 技能、`snow_query` 与 `snow_save_packages` 工具。保存工具展示实际写入摘要，内容改变必须重新确认；模型传入 `confirmed: true` 不能授权。

卡片分别显示购买状态、资料完整度、报价、实付、已付补款和未知项。未知不等于 0，未知列表不等于已确认没有。至少一项真实套餐信息即可保存；空白资料、负金额、无效日期或冲突信息会被拒绝。保存失败不产生成功卡片。

文字套餐保存在 DSH 已配置的本机存储后端，宿主只打开一个 `snow_trip` 数据域。预设仍名为 `snow-trip`；域名使用下划线是因为 DSH 不允许存储域名称包含连字符。「套餐与来源」中的文字套餐卡片只读取宿主记录，不读取或迁移旧 IndexedDB。原工作台已有的台账、方案计算和已存方案继续使用原浏览器存储，页面录入按钮统一进入文字会话；首页列表和统计与“套餐与来源”共用宿主文字套餐记录；旧 Excel 候选单独展示并保留原有计算与对比。文字套餐按已知日期和间夜提示限制，逐晚补款及总价暂不自动计算，未知金额不视为零。卡片上的“继续补全”只打开原会话，不预填提示词、不自动发送，保留已有草稿。补全先查询最新版本，经确认更新原套餐 ID，版本递增；冲突须重新查询确认。文字录入链路尚不支持 Excel、图片、批量和自动规划。

会话成功卡片从持久化工具 metadata 回放保存时的快照；概览读取宿主当前记录，二者使用同一 ID/revision。打开概览、切回概览和会话状态变化时重新读取。只提供 `snowTrip.listPackages/getPackage` 读取接口，不提供客户端写入接口。

使用 DSH 默认 JSON 存储配置时，套餐文件为 `$DSH_HOME/storages/snow_trip.json`；未设置 `DSH_HOME` 时通常位于 `~/.dsh/storages/snow_trip.json`。这是安装者自己的宿主数据，不写入插件安装目录或 Agent 工作目录。下文仓库内 `.local/session-entry-home` 仅为本机隔离测试环境，已被 Git 忽略，也不在插件打包文件清单内。

会话列表支持搜索、重命名、分叉和归档，新增会话自动使用 `~/dsh-snow-trip`。新会话保持空白，不自动发送；关闭工作台不取消执行。会话、附件和套餐保存在本机，助理将任务相关内容发送给 DSH 配置的模型。未发送草稿不保证刷新后恢复。

查询支持 ID、关键词与分页，返回 `total/truncated/nextOffset`。购买平台使用 `purchasePlatform` 记录，例如“微信小程序 xxx”；未知为 null。不再采集或校验 `sources` 消息引用，旧记录兼容读取。

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

`src/service.ts` 在宿主层单实例管理存储与工作台读取接口；`src/tools.ts` 通过包子路径 `dsh-snow-trip/tools` 在雪季预设中装配，注册 `snow_query` 与 `snow_save_packages`。普通预设不获得这两个工具。保存确认在工具内完成，服务端保存方法不暴露为 Remote 接口。

雪季预设设置 `includeDefaultRoots: false`，仅扫描随预设分发的技能目录，不扫描用户级或工作区内的默认技能目录。工作台新建会话使用宿主用户目录下的 `dsh-snow-trip` 工作区，多个会话共享该目录；重新打开历史会话保留原工作区。

雪季技能位于 `presets/snow-trip/skills/<技能名>/SKILL.md`，使用 `name` 和 `description` YAML 元信息。预设的 `agent.cordis.yml` 与官方 Cordis 预设一样装配 `@deepseek-ai/dsh-skill-filesystem` 和 `@deepseek-ai/dsh-tool-skill`，通过 `baseUrl` 解析当前预设的技能目录。新增技能只需新增目录与文件，不修改 `SnowTrip` 服务或维护逐个注册清单。`package.json` 的 `files` 已包含整个 `presets` 目录。

用安装环境中的官方扫描器验证可搬迁与多技能发现：

```sh
SNOW_SKILL_FILESYSTEM=/安装位置/skill-filesystem/lib/index.js node test/skills.integration.mjs
```
