# DSH 工作台仓库

多个 DSH 工作台共用一个 pnpm 工作区。每个工作台在 `packages/` 下独立声明包名、依赖、插件预设和导出，可以分别构建、安装与打包。

当前工作台：[雪季出行](packages/snow-trip/README.md)（`dsh-snow-trip`）。

## 开发

需要 Node.js 22.19 或更高版本、pnpm 11.7.0。以下命令在仓库根目录执行：

```sh
pnpm install       # 安装依赖、应用补丁并自动构建所有工作台
pnpm build         # 构建所有工作台
pnpm test          # 检查所有工作台
pnpm typecheck     # 类型检查
```

仅操作雪季包：

```sh
pnpm --filter dsh-snow-trip build
pnpm --filter dsh-snow-trip test
pnpm --filter dsh-snow-trip pack
```

根目录不是 DSH 插件。构建后通过包目录安装，或分发 `pack` 输出的 tarball：

```sh
dsh plugin --profile web add "$PWD/packages/snow-trip"
```

## 目录与新增工作台

- `packages/snow-trip/`：雪季源码、测试、预设、包说明和构建产物。
- `tsconfig.json`：共用 TypeScript 配置；具体构建脚本位于各包内。
- `tsconfig.host.json`：明确列出参与 Remote 分析的工作台。
- `patches/`：已锁定版本的生成器补丁，详见[补丁说明](patches/README.md)。
- `docs/`、`experiments/`：设计与验证记录、参考资料和实验脚本。

新增工作台时，在 `packages/<名称>/` 中声明唯一的包名和 DSH 插件入口，业务依赖放在自己的 `package.json` 中。需要 Remote 的工作台须将其服务端配置（如 `tsconfig.server.json`）加入 `tsconfig.host.json` 的 `references`，避免生成器依赖尚未生成的客户端 Remote。包内保留独立的 `build`、`test`、`typecheck` 命令，根目录通过 pnpm 递归执行。

各包自行定义构建入口与发布文件；根目录只调度包内命令，不约定服务或客户端文件名。出现实际重复业务代码后再提取共享包。

生成器直接读取真实包目录，不创建临时工作区。pnpm 补丁仅修复构建工具对已安装协议包的识别，不修改 DSH 宿主。
