# 首页实施任务

已按用户确认的拆分发布 5 张本地任务，尚未实施。父规格保持不变。

| 任务 | 状态 | 阻塞依赖 |
| --- | --- | --- |
| [HOME-01 · 从首页月历查看套餐与行程](01-home-calendar.md) | 可执行 | 无 |
| [HOME-02 · 切换地图并浏览酒店与雪场清单](02-map-browse.md) | 等待前置任务 | [HOME-01](01-home-calendar.md) |
| [HOME-03 · 自动定位明确地点并保存结果](03-auto-locate.md) | 等待前置任务 | [HOME-02](02-map-browse.md) |
| [HOME-04 · 确认歧义地点并纠正位置](04-confirm-place.md) | 等待前置任务 | [HOME-03](03-auto-locate.md) |
| [HOME-05 · 按月份查看地图分布](05-map-months.md) | 等待前置任务 | [HOME-03](03-auto-locate.md) |

依赖：`01 → 02 → 03 → {04, 05}`。默认执行顺序为 01–05；04 与 05 互不阻塞。任务依赖与地图凭据条件分别记录；无凭据不能将真实地图验收标为通过。

开始入口：[HOME-01](01-home-calendar.md)。总体验收与边界见[父规格](../spec.md)，拆分依据见[任务拆分记录](../ticket-breakdown.md)。
