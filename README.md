# 雪季出行工作台

独立 DSH Web 插件。在工作台内创建和继续雪季助理会话，复用 DSH 标准聊天、模型配置、消息历史和附件存储。原有台账导入、筛选、核算和方案保存界面保持不变，SNOW-01 在原左栏增加助理会话入口；助理套餐解析和保存工具尚未接入。

## 使用

点击 DSH 左下角「雪季出行」，仍进入原来的“找出行方案”首页。原左栏的“找出行方案 / 已存方案 / 套餐与来源”下方增加“新增会话”和雪季会话列表。新增会话固定使用 DSH 宿主当前用户目录下的 `~/dsh-snow-trip`，目录不存在时自动创建，不展示工作区选择。打开会话时右侧显示标准聊天及附件输入，点击原导航即可返回相应页面。新会话保持空白，用户发送后才调用模型；关闭工作台不会取消执行。

会话和附件由 DSH 本机宿主保存，交流内容会发送给 DSH 配置的模型。模型在 DSH 主界面配置；本票不装配工作台内的模型切换、斜杠命令、权限审批扩展。草稿在当前页面生命周期内保留，刷新页面不保证恢复未发送草稿。

插件另提供宿主认证的 `snowTrip.listPackages` 空集合接口，为后续助理业务数据接入保留最小通路；不替换当前台账展示。预设目录随包分发，装配器保留 Web profile 原 `agent-presets` 配置与默认预设，再追加雪季目录；定制 profile 需保留该条目。兼容范围见验证记录。

会话按今天、昨天和更早分组，支持标题搜索；当前会话高亮，尚未开始的空白会话不展示在列表，新增后仍可直接输入。行内“···”提供重命名、分叉会话和归档会话，直接调用 DSH 插件公开能力。重命名支持 Enter 保存；分叉保留已完成对话并打开新会话；归档需二次确认，由宿主保存并同步到其他浏览器，保留历史且不停止任务。旧版浏览器隐藏记录不再用于过滤，也不自动迁移为归档。侧边栏可拖拽或使用左右方向键调整宽度。

### 台账与方案

直接使用原来的导航与功能，不设置新旧版入口。当前浏览器台账不混入后续宿主套餐数据源。首次点击「导入台账」，选择 `.xlsx`，核对工作表、表头行和字段映射后确认。以后用「更新台账」替换当前数据；原 Excel 不变。

- 必需字段：编号、套餐名称、住宿晚数、订单金额；其他列可手动映射。
- 按编号关联详情表，例如 `001套餐详情`。格式变化可重新映射主表；不识别的详情规则保留原文，不声称通用自动识别。
- 自动计算明确起止日期、额外每间夜加价和明确星期条件。未覆盖日期不当成免费；区间重叠不自动取高或取低。
- 房型矩阵、缺失年份、套餐总价表及混合日期文本仍需人工核对。不把 002 的规则套给 003，不把 008 的总价表当成补款。
- 原订单已付、已付额外补款、本次新增费用分开。总间夜不是剩余晚数。可拆套餐的原订单已付金额包含本次之外间夜。
- 最多对比 3 个候选，填写房间补款、交通与其他费用；空白表示未知，`0` 才表示无此支出。保存快照后可导出 JSON。
- 数据仅存在当前浏览器、当前 DSH 地址的 IndexedDB，不上传。更换端口/浏览器需要重新导入。原始截图仍在 Excel，不做 OCR。
- 机酒实时价格、库存接口尚未接入；台账匹配不代表有房。已预约、年份缺失和权益限制单独提示。

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
