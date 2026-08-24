## Summary

M3 Mock 增量：**cancelOrder**、广场筛选默认值/清除竞态修复、POI 扩展至 15 点、通知按用户过滤。

- `cancelOrder` Mock：乘客 → `closed`；司机 `pending_departure` → `matching`（回广场）
- 广场筛选：首次进入默认今天 + 下一 15 分钟档；清除回「全部」；修复 picker 与 `onShow` 竞态
- POI：`poi-13` 迪心楼 / `poi-14` 比斯特 / `poi-15` 羽托邦
- 通知：`pages/notify/notify.js` 按 `recipientOpenId` 过滤

## 文档

- [`M3_INTEGRATION_STATUS.md`](./docs/M3_INTEGRATION_STATUS.md)
- [`DATA_MODEL.md`](./docs/DATA_MODEL.md) · 司机取消回 `matching`
- [`MODULE_CONTRACTS.md`](./docs/MODULE_CONTRACTS.md) · `cancelOrder` Mock 已实现
- [`M3_DEMO_FLOWS_PM.md`](./docs/M3_DEMO_FLOWS_PM.md)

## 请 Owner 确认（合并前）

- [ ] **@M2** — `pages/index/` 筛选 UI（默认/清除/分区）
- [ ] **@M1** — `pages/notify/notify.js` 通知过滤

## Test plan

- [ ] Alice 发单 → Bob 广场可见
- [ ] Bob 筛选 / 清除 / 接单
- [ ] 乘客/司机取消（`detail` + `history-detail` 二次确认）
- [ ] 司机取消后订单回广场 `matching`
- [ ] Alice 通知页仅看到自己的通知
- [ ] POI 15 点路线与种子单正常展示

## Follow-up（不阻塞）

- `startTrip`（P1）、云库替换 Storage
- Mock 移除计划见 `M3_INTEGRATION_STATUS.md` §10
