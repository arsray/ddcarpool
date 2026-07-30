# M3 — order 模块

负责人：_待填写_

## 职责

- 订单 CRUD 与状态机
- 固定点位配置
- 路线文案格式化

## 接口

见 `docs/MODULE_CONTRACTS.md` → M3 order 模块

## 数据

- 集合 `orders`、`points`
- 默认点位：`constants.js`

## 实现状态

| 函数 | 状态 |
|------|------|
| `listOpenOrders` | stub |
| `getOrderById` | stub |
| `createOrder` | stub |
| `acceptOrder` | stub |
| `cancelOrder` | stub |
| `completeOrder` | stub |
| `listPoints` | stub（可返回 DEFAULT_POINTS） |
| `formatRoute` | stub |
