# M1 — auth 模块

负责人：_待填写_

## 职责

- 微信登录（openid）
- 用户 Profile 读写
- 「我的订单」列表（可调 order 模块）

## 接口

见 `docs/MODULE_CONTRACTS.md` → M1 auth 模块

## 实现状态

| 函数 | 状态 |
|------|------|
| `ensureLogin` | stub |
| `getProfile` | stub |
| `requestProfile` | stub |
| `listMyOrders` | stub |

## 错误码（实现时补充）

| code | 说明 |
|------|------|
| `AUTH_NOT_LOGGED_IN` | 未登录 |
| `AUTH_PROFILE_DENIED` | 用户拒绝授权 |
