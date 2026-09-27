# 手机跨网络访问 DSH Web：研究与接入建议

研究日期：2026-09-25。目标：手机使用 4G/5G、电脑使用 Wi-Fi，访问电脑现有的雪季工作台，保留实时聊天与认证。本文只研究，不安装软件、开放服务、重启宿主或修改生产配置。

## 结论与证据边界

**工程建议：个人自用优先试点 Tailscale Serve；手机不能安装或连接 Tailscale 时，再考虑 Cloudflare 正式 Tunnel + 域名 + 访问认证。** 这是根据官方能力与当前 DSH 源码得出的配置方案，不是 DSH 官方集成教程，也不是已完成的移动网络兼容认证。

已验证 DSH 的认证、Host/Origin 信任和 CLI 相关 4 个测试文件、23 项测试全部通过；未完成真实手机移动网络、代理 WebSocket、息屏恢复和网络切换测试。本机 PATH 未发现 `tailscale` 或 `cloudflared`，`/Applications` 未发现 Tailscale 应用；这不排除安装在其他路径。

宿主研究基线为 `d65fc7ad324f61dafdcf1190ae951638518a2679`，根包版本 `0.1.5-alpha.1`，宿主存在既有未提交改动；结论针对本机工作树，不代表 GitHub 最新版本。[宿主版本](/Users/liuyunxia/Documents/ai/deepseek-harness/package.json:3)

## 已核实：DSH 实际需要什么

| 问题 | 核查结论与来源 |
|---|---|
| 不支持 SSE 就不能聊天？ | 不是。此版普通 Web 客户端为 HTTP RPC + WebSocket，流式连接是 `/api/remote.mux`，HTTPS 页面使用 WSS。[传输](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/client/index.ts:74)、[流式 URL](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/api/gateway/src/client/stream-client.ts:304) |
| 需要修改宿主源码吗？ | 已有 `--trusted-host` 配置入口，支持裸域名或 `host:port`；CLI 明确拒绝 `--host 0.0.0.0`。使用 loopback 服务加代理有现成配置基础，是否完全兼容仍需实测。[CLI](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/bundle/web-app/src/startup.ts:46)、[authority 校验](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/api-request-trust.ts:35) |
| 页面打开就算成功吗？ | 不算。API 与 WebSocket 都需要通过来源检查及 cookie 认证。Host 必须可信，Origin 的 authority 必须与 Host 一致，跨站请求会拒绝。[检查逻辑](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/api-request-trust.ts:91)、[API](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/rpc-host.ts:96)、[WS](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/api/gateway/src/index.ts:212) |
| 手机怎么登录？ | 以远端域名访问 `/?token=<当前宿主进程令牌>`，由宿主兑换绑定该 authority 的 cookie。localhost 登录态不能直接搬到手机域名。[认证](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/browser-auth.ts:240)、[cookie 校验](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/browser-auth.ts:289) |
| 首次登录能直接进工作台吗？ | 当前 `/?token=...&app=snow-trip` 会 303 到固定 `/`，丢掉 app 参数。应先登录，再收藏不含 token 的 `https://<域名>/?app=snow-trip`。[重定向](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/browser-auth.ts:256)、[插件入口](/Users/liuyunxia/Documents/dsh/huaxue/src/client.jsx:18) |

DSH cookie 默认绝对有效期为 30 天，包含 `HttpOnly; SameSite=Strict`，当前源码未设置 `Secure` 属性。部署应保持手机侧 HTTPS、宿主侧仅 loopback，并保留 DSH 原认证；Tailscale 网络准入不能替代它。[cookie 属性](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/browser-auth.ts:120)、[默认期限](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/index.ts:90)

## 方案比较：事实与工程取舍

| 方案 | 已核实能力 | 工程判断 |
|---|---|---|
| Tailscale Serve | 私有 HTTPS、本地端口代理、网络访问控制；个人计划免费。[官方文档](https://tailscale.com/docs/features/tailscale-serve)、[定价](https://tailscale.com/pricing) | 自己的手机访问自己的电脑，优先试点；手机需保持 Tailscale 连接。 |
| Cloudflare 正式 Tunnel | 账号、自有并在 Cloudflare 管理的域名、cloudflared；正式 Tunnel 支持 SSE，Cloudflare 支持 WebSocket。[部署](https://developers.cloudflare.com/tunnel/get-started/#prerequisites)、[SSE 对比](https://developers.cloudflare.com/sandbox/api/tunnels/#named-tunnels)、[WS](https://developers.cloudflare.com/network/websockets/) | 手机必须用其他 VPN 或只想用浏览器时考虑；公网入口需要身份门禁，域名注册续费另计。 |
| Cloudflare Quick Tunnel | 随机地址、测试用途、不保证 uptime、200 个在途请求上限、不支持 SSE。[官方限制](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/#limitations) | 不支持 SSE 不足以否定此版 DSH 的 WS 聊天，但不作为长期稳定性的首选。 |
| phone-tunnel-pool | 社区作者提供 Quick Tunnel 池和扫码入口，默认 3080，可用 DSH_TARGET_PORT 覆盖。[作者固定版本 README](https://github.com/iimaguest/phone-tunnel-pool/blob/bff870f6aa4f47c94063b84397660eb289c2a685/README.md) | 不作为当前默认安装项；需要单独核验新版本 DSH 认证兼容性。 |

Tailscale 的具体依据：

- 官方 CLI 支持 `tailscale serve [flags] <target>` 与 `--bg`。Mac App Store / Standalone 都可以转发端口，限制主要针对 Serve 本地文件或目录。部署前确认安装版本和 CLI 路径；本文未验证本机二进制。[CLI](https://tailscale.com/docs/reference/tailscale-cli/serve#serve-command-flags)、[macOS CLI 路径](https://tailscale.com/docs/reference/tailscale-cli?tab=macos#using-the-tailscale-cli)
- 当前官方源码固定快照 `d229a06f9a4b2340f0749288df0ac4f6de223acd` 对普通 HTTP 后端明确设置 `r.Out.Host = r.In.Host`，保留外部域名。这与 DSH 配置真实 `*.ts.net` 域名为 trusted host 的方式相符，不能误以为后端是 localhost 就无需声明域名。[Serve 源码](https://github.com/tailscale/tailscale/blob/d229a06f9a4b2340f0749288df0ac4f6de223acd/ipn/ipnlocal/serve.go#L960-L998)
- Serve 使用 Go ReverseProxy；Go 实现支持 HTTP 101 升级和 `text/event-stream` 即时刷新。这是支持 WS/SSE 的实现依据，不等于已经对本机 DSH 端到端测试。[协议升级](https://github.com/golang/go/blob/go1.26.0/src/net/http/httputil/reverseproxy.go#L573-L578)、[SSE 刷新](https://github.com/golang/go/blob/go1.26.0/src/net/http/httputil/reverseproxy.go#L676-L690)
- **手机其他 VPN 是选型前置条件**：iOS / Android 通常只允许一个 VPN 同时运行。若用户必须使用其他 VPN，不能假定可以同时连接 Tailscale。[官方兼容说明](https://tailscale.com/docs/reference/faq/other-vpns)
- DERP 中继路径通常比直连慢；可用 `tailscale ping <设备>` 观察连接路径。用户所在运营商的可达性、实际延迟需要手机移动网络实测，本文不承诺国内各网络稳定性。[连接类型](https://tailscale.com/docs/reference/connection-types#derp-relayed-connections)
- 当前个人计划免费，最多 6 位用户、无限用户设备，定位个人用途；不将旧版套餐数字作为依据。[当前定价](https://tailscale.com/pricing)

Cloudflare 正式 Tunnel 有免费使用路径，但自有域名的注册续费不在免费隧道内；WebSocket 也可能因 Cloudflare 更新而断开，需要客户端重连。它避免的是 Quick Tunnel 产品限制，不是所有断线或延迟。[官方免费 Tunnel 公告](https://blog.cloudflare.com/tunnel-for-everyone/)、[WebSocket 技术说明](https://developers.cloudflare.com/network/websockets/#technical-note)

社区插件需额外审查的原因：固定版本 `bff870f6aa4f47c94063b84397660eb289c2a685` 会改写 Host 并删除 Origin / Referer，同时使用自己的 Basic/session-cookie 认证、注入浏览器凭据供域名迁移。这不是透明转发；现有证据不足以证明它与本机 DSH 的 token/cookie 首登流程兼容。此判断不是完整安全审计。[请求头改写](https://github.com/iimaguest/phone-tunnel-pool/blob/bff870f6aa4f47c94063b84397660eb289c2a685/cf-auth-proxy.mjs#L198-L209)、[凭据注入](https://github.com/iimaguest/phone-tunnel-pool/blob/bff870f6aa4f47c94063b84397660eb289c2a685/cf-auth-proxy.mjs#L354-L360)、[WS 代理](https://github.com/iimaguest/phone-tunnel-pool/blob/bff870f6aa4f47c94063b84397660eb289c2a685/cf-auth-proxy.mjs#L376-L415)

## 推荐配置草案：Tailscale Serve

Serve 将同一 Tailscale 私有网络内的请求转发到本机端口，提供 HTTPS；手机和电脑不需要在同一个物理局域网。跨网络能直连时直连，否则可经中继，仍使用端到端加密。[Serve](https://tailscale.com/docs/features/tailscale-serve)、[连接类型](https://tailscale.com/docs/reference/connection-types)

以下是待部署模板，**不是本次已执行的命令**。前提是电脑、手机已安装并登录 Tailscale，启用 Serve 所需 HTTPS，确认访问控制允许手机到电脑的 HTTPS 入口。[Serve 前置条件](https://tailscale.com/docs/features/tailscale-serve#get-started-with-serve)

```sh
# 电脑：把当前 loopback 端口提供给私有网络
# 首次配置可能提示前往 Tailscale 控制台完成授权。
tailscale serve --bg http://127.0.0.1:4330
```

获得真实的 `设备名.网络名.ts.net` 后，在合适时机重启原 DSH 进程，保留原有模型、profile 和 DSH_HOME；不能同时再启动一个占用 4330 的实例。当前本机启动路径来自项目已有运行说明。[现有启动方式](/Users/liuyunxia/Documents/dsh/huaxue/README.md:37)

```sh
cd /Users/liuyunxia/Documents/ai/deepseek-harness
DSH_HOME=/Users/liuyunxia/Documents/dsh/huaxue/.local/session-entry-home \
  pnpm dsh --profile web --host 127.0.0.1 --port 4330 \
  --trusted-host '<实际设备名.网络名.ts.net>' --no-open
```

注意 `--trusted-host` 不带协议或路径。手机先用远端域名兑换当前进程 token，再打开工作台参数地址；真实 token 不写入本文、仓库或公开链接。[参数校验](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/api-request-trust.ts:35)、[认证兑换](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/connection/src/browser-auth.ts:240)

## 手机体验的已知差异

- 远端域名被客户端识别为非 loopback，部分设置采用内存持久化，通用设置不创建与本机相同的文档控制器。不能承诺整个 DSH 界面与 localhost 完全等价。[设置存储](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-settings/src/client/index.ts:58)、[通用设置](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/client/ui-settings-general/src/client/index.ts:76)
- 本地 Mac 启动、监听 loopback 且非 SSH 时，目录选择器自动选 native。经隧道访问并不能改变这一启动时判定，手机触发目录选择可能在电脑弹窗。需要远程目录选择时，官方源码说明建议直接组合 browse 实现；但雪季新建会话路径调用服务端 `ensureWorkspace()`，自动创建宿主用户目录下的 `dsh-snow-trip`，再直接按路径创建 workspace，不走目录选择器，因此此限制不是雪季新建会话的既知阻塞。[雪季新建入口](/Users/liuyunxia/Documents/dsh/huaxue/src/client.jsx:127)、[默认目录](/Users/liuyunxia/Documents/dsh/huaxue/src/service.ts:158)、[宿主按路径创建](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/api/workspace-controller/src/client/service.ts:92)；[选择规则](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/host/directory-picker-auto/src/resolve.ts:49)、[已知限制](/Users/liuyunxia/Documents/ai/deepseek-harness/packages/host/directory-picker-auto/README.md:108)

## 验证记录与部署验收

在宿主目录运行了以下现有测试，结果 **4 个文件 / 23 项通过**，Vitest 4.1.8。这验证源码规则，不等于验证 Tailscale 或 Cloudflare 网络链路。

```sh
./node_modules/.bin/vitest run \
  packages/client/connection/tests/api-request-trust.host.spec.ts \
  packages/client/connection/tests/browser-auth.host.spec.ts \
  packages/bundle/web-app/tests/startup.spec.ts \
  packages/bundle/web-app/tests/trusted-hosts.spec.ts
```

后续最小验收（工程建议）：

1. 手机关闭 Wi-Fi，只用 4G/5G，登录后打开工作台。
2. 检查 API 无 401/403，WebSocket Upgrade 成功；发送一条无副作用测试消息，观察逐步返回。
3. 验证套餐读取、模板选择和图片附件入口。
4. 切换 Wi-Fi/移动网络、短暂息屏后返回，验证重连和既有消息恢复。
5. 手机断开 Tailscale 或撤销设备访问后，确认私有入口不可达；恢复授权后重试。
6. 停止试点时关闭专用于本次的 Serve 映射，恢复原 DSH 启动参数；不重置可能属于其他服务的全部配置。

本次未安装、未启用远程访问、未修改宿主或雪季插件业务源码，也未创建或发送聊天消息。
