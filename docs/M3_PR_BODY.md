## Summary

M3 Mock 订单主路径：**乘客发单（matching）→ 司机接单（pending_departure）→ 完成（completed）**；广场筛选/接单、发布页、接单通知、custom-tab-bar 已打通。

- 五态 DATA_MODEL v2 + order 模块（Storage Mock）
- 广场 `listOpenOrders` / `acceptOrder`；详情 `completeOrder`（Mock 跳过 `startTrip`）
- 文档：[`M3_DEMO_FLOWS_PM.md`](./docs/M3_DEMO_FLOWS_PM.md)、[`M3_INTEGRATION_STATUS.md`](./docs/M3_INTEGRATION_STATUS.md)

## 契约 / 文档（Ray Review 已处理）

- [x] **无契约 breaking 变更**（`cancelOrder` / `startTrip` 降为 **P1**；Mock 未实现）
- [x] `ORDER_INTEGRATION_GUIDE.md` 注明 **以 DATA_MODEL v2 为准**；P0 仅乘客发单
- [x] Mock 跳过「出发」：PR 说明 + DATA_MODEL / status-machine 已记录

## 请 Owner 确认（合并前）

- [ ] **@M2** — `pages/index/` 广场 UI + `custom-tab-bar/` + Tab 底部留白
- [ ] **@M1** — `auth/store` + Mock 账号切换（Bob / Alice）+ 通知跳详情

## Test plan

- [ ] Alice 发布 → 广场 `matching` 可见
- [ ] Bob 接单 → `pending_departure`，Alice 通知含路线/时间
- [ ] Bob 详情页「完成」→ `completed`
- [ ] 切换 Mock 账号：我的 → 账号与安全
- [ ] 过期 matching → `closed`

## Follow-up（不阻塞）

- 备注字数已在 DATA_MODEL 统一为 **100**（与 `validate.js` 一致）
- `MVP_SCOPE.md` 已对齐 v2
- Mock 移除计划见 `M3_INTEGRATION_STATUS.md` §10
