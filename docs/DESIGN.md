---
version: alpha
name: 雪季出行
description: 从已购台账找到下一程的雪季规划工作台
colors:
  primary: "#31594b"
  ink: "#233a34"
  muted: "#63736d"
  paper: "#f5f7f4"
  surface: "#ffffff"
  line: "#dce3dd"
  accent: "#af6735"
  danger: "#9a4031"
typography:
  sans:
    fontFamily: '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'
  display:
    fontFamily: '"Songti SC", "STSong", serif'
rounded:
  DEFAULT: "7px"
  card: "10px"
spacing:
  page: "38px"
  card: "18px"
components:
  button:
    rounded: "7px"
  card:
    rounded: "10px"
---

# 雪季出行设计约定

## 当前结构（SNOW-02）

默认入口为宿主套餐只读概览，沿用原松林绿、纸白、卡片与侧栏。左栏保留新增会话与雪季历史；右侧在套餐卡片和 DSH 标准会话之间切换。录入在会话进行，确认使用 DSH user-questions 控件，工具落盘成功后才显示成功卡片。未知项与购买状态独立呈现。

卡片共享同一展示组件：会话读取工具 metadata，概览读取 `snowTrip.listPackages`。新版不访问 IndexedDB；下文原台账表单设计暂留于 `legacy` 代码路径，当前界面不提供这些操作。

## Overview
面向持有多个滑雪套餐的中文用户，核心任务是核对日期、补款和使用限制后保存出行候选。以山野行程手册为视觉参考，低饱和松林绿和纸白表达户外感，唯一视觉重点是首页山形示意图。不是实时售票平台，不展示伪造雪况和机票报价。

用户提供的当前 Excel 是业务依据；没有既有前端或设计系统可复用。DSH 通过 sidebar.footer.action 追加入口，沿用宿主 React 和原生对话框焦点行为，不替换宿主页面。中文是本插件固定内容语言，宿主导航和全局主题不受影响。

## Colors
本文件记录 packages/snow-trip/src/client/style.css 中同名 CSS 变量的接受值，CSS 是运行时唯一来源。卡片、表单、表格和提示均引用该层。雪山插画用局部景观色。警告通过文字和图标共同表达。

## Typography
正文使用中文系统无衬线字体；宋体只用于首页标题与侧栏短句。数字使用等宽数字特性。完整套餐名与长条件可在详情中阅读。

## Layout
桌面左侧导航 206px；主体有上栏、山形引导、统计、筛选和三列卡片。1150px 以下两列；760px 以下顶部导航和单列卡片。数据表独立横向滚动，页面自然纵向滚动。

## Elevation & Depth
常规内容使用浅边框；只有模态框和底部对比操作区有阴影。视觉重点不依赖动效。

## Shapes
控件 7px，卡片 10px，顶部引导 12px。无额外图标库。

## Components
表单与日期由浏览器原生 input/select 负责，接受系统弹层语言和几何。业务验证在表单中显示。弹窗由原生 dialog 管理焦点、背景隔离和 Escape 关闭；App 内嵌模态框与 DSH 工作台模态框分层。

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Field + 原生 select | DESIGN.md | native | 浏览器键盘与窄屏 |
| Date | date input + ledger.js | DESIGN.md | native | 日期边界测试 |
| Form | search / Importer | workbench.jsx | 业务验证 | 无效输入保留 |
| Scrollbar | .snow 样式 | style.css | 作用域继承 | 窄屏滚动 |
| Toast | App notice / error | workbench.jsx | 提示和错误 | aria-live |

按钮悬停、按下、聚焦、禁用状态统一。导入期间按钮禁用、尺寸稳定；不使用骨架屏。空结果有重置动作，导入失败保留旧台账。导出仅包含用户选择的方案快照。金额使用人民币本地格式。已购总间夜不叫“剩余晚数”。未覆盖日期、冲突区间、总价表都不能变成零补款。

## Do's and Don'ts
- 保留原文及行号；人工估算与台账依据分开显示。
- 台账更新替换当前候选，不改变已存方案快照。
- 不将同酒店不同套餐的规则互相套用。
- 不把图片中的未知字段猜成事实，不把可匹配当成有库存。

## 会话列表（2026-09-23）

范围限定在现有侧栏，服务于查找并继续雪季出行对话。保留原导航和首页。去掉重复的白色卡片及外置叉号，改为今天／昨天／更早的紧凑列表；唯一强调是当前项的松绿色底与窄路标，表示正在查看的对话。

颜色沿用松林 `#31594b`、墨绿 `#233a34`、浅苔 `#eef2ec`、选中浅绿 `#dce7df`、灰绿 `#63736d`；小节标题用宋体 16px，正文 PingFang / 系统字 13px（窄屏 12px），时间 Avenir Next / 系统字 10px。无额外装饰动画，仅操作按钮轻微显隐，并遵守减少动态效果设置。

结构为“新增 → 标题搜索 → 日期分组 → 模型发送说明”；按用户意见移除小节标题与数量。空白会话显示“新会话 / 尚未开始”，不拿工作区目录名当内容标题；用户自定标题优先保留。长标题单行省略并提供完整 title。行内“···”操作入口提供重命名、分叉与归档，复用 DSH 插件；鼠标悬停和键盘聚焦时显露，触屏常显，归档继续使用二次确认。搜索无结果有提示，Escape 先清空搜索，避免误关工作台。
