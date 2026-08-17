# M1 — auth 模块

负责人：Crystal (@Crystal-la)

## 职责

- 微信登录（openid）
- 用户 Profile 读写
- 「我的订单」列表（可调 order 模块）

## 接口

见 `docs/MODULE_CONTRACTS.md` → M1 auth 模块

## 实现状态（Mock 预览阶段）

| 函数 | 状态 |
|------|------|
| `ensureLogin` | Mock：邮箱登录态 + mock openId |
| `getProfile` | Mock：本地 userInfo → userProfile |
| `requestProfile` | Mock：读本地缓存 |
| `listMyOrders` | Mock：historyOwner/Passenger → Order 映射 |

## 内部文件

| 文件 | 说明 |
|------|------|
| `store.js` | 预览态会话与 Profile 扩展字段 |
| `mock.js` | Mock 历史订单与通知（`MOCK_SEED_VERSION`，登录/启动自动注入） |
| `mapper.js` | UI 状态 ↔ DATA_MODEL Order 映射 |
| `email.js` / `verify.js` | 邮箱验证码 Mock（P0 接真实发信） |
| `vehicle-data.js` | 车辆/偏好静态数据 |
| `order-actions.js` | 订单详情操作按钮规则 |

## 错误码

| code | 说明 |
|------|------|
| `NOT_LOGGED_IN` | 未登录 |
| `PROFILE_NOT_FOUND` | 无用户资料 |
