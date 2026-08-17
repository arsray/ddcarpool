# PR：M3 五态数据模型 + order 模块契约（v2）

## Summary

- 将 `orders.status` 从四态（`open/matched/...`）升级为 **五态**，与 PRD v1.1 / `ORDER_FLOWS_PM.md` 一致
- 明确 P0 主流程：**乘客发单（matching）→ 司机接单（pending_departure）→ 行程闭环**
- 新增 `configured_routes` 集合与 `match.js` 顺路计算约定
- 提供 `modules/order/index.js` 公共 API 草稿（JSDoc + 错误码）

## 请 Review 的同学

- @M1 — `passengerOpenId` / `driverOpenId` 字段；`listOrdersForUser`；接单通知
- @M2 — `listOpenOrders` 返回字段、`order-card` properties
- @M4 — 聊天准入状态改为 `pending_departure | in_progress`

## Files to copy into repo

| 本 PR 包内路径 | 仓库目标路径 |
|----------------|--------------|
| `docs/DATA_MODEL.md` | `docs/DATA_MODEL.md`（替换） |
| `docs/MODULE_CONTRACTS_M3.md` | 合并进 `docs/MODULE_CONTRACTS.md` 的 M3 节 |
| `miniprogram/modules/order/**` | `miniprogram/modules/order/**` |

## 合并后 M3 下一步

- [ ] 实现 `service.js`（云开发 `orders` CRUD）
- [ ] `pages/publish` 接 `createOrder`
- [ ] `pages/detail` 接 `acceptOrder` / `startTrip` / `completeOrder`
- [ ] CP1：M2 首页 `listOpenOrders`

## Test plan

- [ ] 发单后 status = `matching`，广场可见
- [ ] 司机接单 → `pending_departure`，乘客单同步
- [ ] 过 `departTime` 仍为 matching → `closed` + `expired`
- [ ] `in_progress` 不可 cancel
- [ ] 顺路列表按 `matchScore` 降序
