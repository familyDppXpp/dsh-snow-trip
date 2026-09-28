# Typert 构建依赖补丁

`@deepseek-ai/dsh-typert-generator@0.1.7-rc.2` 的 `isTypeMetaSymbol()` 只识别工作区协议包或具名模块声明，不能识别正常安装的协议包。

本补丁移植社区修复：复用 `externalModuleIdentityForFile()`，仅在声明的外部包名为 `@deepseek-ai/dsh-typert-protocol` 时识别 Remote 元数据，保留原有判断。

- [sophon2000 原始修复 7804432](https://github.com/sophon2000/deepseek-harness/commit/7804432c031fa07d75531ce65e6fb4cced66a32e)
- [leecky 等价修复 105cf46](https://github.com/leecky/deepseek-harness/commit/105cf46fde8c2df18bfd032c7f695db3ba5cc910)
- [上游问题 #2981](https://github.com/deepseek-ai/deepseek-harness/discussions/2981)

发布包的主入口 `lib/index.js` 内含分析器副本，`./tsdown` 入口使用 `lib/types/analyzer.js`，所以补丁同时修改这两个文件。pnpm 安装时按锁定版本应用，测试 `packages/snow-trip/test/typert-generator.test.mjs` 检查两个入口生成一致产物，并拒绝其他包的同名装饰器。

升级生成器时重新验证补丁；官方版本支持已安装协议包后，移除补丁与 `patchedDependencies` 配置并更新锁文件。此补丁不改变宿主运行时。本仓库通过真实的 `packages/*` 布局和 `tsconfig.host.json` 项目引用满足生成器的发现要求，因此无需临时工作区。
