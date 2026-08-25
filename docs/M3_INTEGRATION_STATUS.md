# M3 Mock 集成状态（开发 / Agent 版）

【读者】M2/M3/M4 开发、Cursor 等 Agent  
【产品经理】可读第 1、3、6 节  
【何时阅读】联调、Review PR、或 Agent 需知「已实现什么」时  

> **契约准绳：** [`DATA_MODEL.md`](./DATA_MODEL.md) v2（存库枚举）、[`MODULE_CONTRACTS.md`](./MODULE_CONTRACTS.md)、[`ORDER_INTEGRATION_GUIDE.md`](./ORDER_INTEGRATION_GUIDE.md)（完整愿景；P0 以 DATA_MODEL 为准）  
> **本文件：** 描述 **`feat/m3-driver-plaza` 分支实际代码**，可能与集成指南的「待实现」清单不同步——以本文件 + 代码为准。

**PR：** `feat/m3-driver-plaza` → `main`  
**仓库：** https://github.com/arsray/ddcarpool

---

## 1. 一句话交付范围

在 **无云开发** 条件下，用本地 Storage 实现 P0 主路径：

`createOrder (matching)` → `acceptOrder (pending_departure)` → `completeOrder (completed)`

广场 `listOpenOrders`、司机活跃单 `listDriverActiveOrders`、乘客接单通知已打通。

---

## 2. 目录与 Owner 交叉

| 路径 | Owner | 本 PR 改动 |
|------|-------|------------|
| `miniprogram/modules/order/**` | M3 | ✅ 核心 |
| `miniprogram/pages/publish/**` | M3 | ✅ |
| `miniprogram/pages/detail/**` | M3 | ✅ |
| `miniprogram/pages/index/**` | M2/M3 | ✅ 广场 UI + 接单 |
| `miniprogram/custom-tab-bar/**` | M2 | ✅ 请 M2 Review |
| `miniprogram/styles/base.wxss` | M2 | ✅ Tab 页底部留白 |
| `miniprogram/modules/auth/mock-users.js` | M1/M3 | ✅ Mock 账号 |
| `miniprogram/pages/notify/notify.js` | M1 | ✅ 通知跳详情 |

---

## 3. 已实现 API（`require('modules/order/index')`）

| 函数 | 状态 | 说明 |
|------|------|------|
| `createOrder` | ✅ | 校验 POI、时间窗、人数、备注 ≤100 字 |
| `acceptOrder` | ✅ | matching → pending_departure；写乘客通知 |
| `completeOrder` | ✅ | pending_departure / in_progress → completed |
| `cancelOrder` | ✅ | 乘客取消 → closed；司机取消匹配 → matching |
| `listOpenOrders` | ✅ | 广场匹配中；排除过期、排除 viewer 自己的单 |
| `listDriverActiveOrders` | ✅ | pending_departure + in_progress |
| `getOrderById` | ✅ | |
| `expireStaleOrders` | ✅ | matching 过期 → closed |
| `listPoints` / `formatRoute` / `computeMatchScore` | ✅ | |
| `startTrip` | ❌ | 抛出 NOT_IMPLEMENTED |

**存储键：** `m3_orders_v1`（`service.js`，接入云库时替换）

**种子单：** `seed-orders.js` · App 启动刷新 · 已接单模板不再克隆重复单

---

## 4. 状态机（`status-machine.js`）

```
matching ──accept──→ pending_departure ──complete──→ completed
     │                      │    │
     └──expire──→ closed    │    └──start──→ in_progress ──complete──→ completed
                            └──complete──→ completed   （本 PR UI 走 complete 短路）
```

本 PR **UI 未暴露** `startTrip`；`completeOrder` 允许从 `pending_departure` 直接完成。

---

## 4.1 广场排序（`plaza-sort.js`）

`listOpenOrders` / 广场列表在 `comparePlazaOrders` 中按以下优先级 **升序** 排列：

1. `departTime`（出发时间窗起点）
2. 起点 POI `sortOrder`
3. 终点 POI `sortOrder`
4. **`createdAt` 升序**（先发布在前）

筛选后 UI 分区（「符合条件 / 其他」）见 `plaza-filter.js`；分区内保持 `listOpenOrders` 既有顺序，不额外重排。

---

## 5. 待其他模块接入 / 未完成

### M1

- [ ] `getPassengerHistoryItems` / `getDriverHistoryItems` 与「我的订单」列表完全同步五态  
- [x] 通知按 `recipientOpenId` 过滤（`pages/notify/notify.js` Mock）  
- [ ] 取消/关闭后的列表与弹窗文案  

### M2 — 请 Owner Review 并在此 PR 回复确认

- [ ] `pages/index/` 广场 UI（筛选、已接单区、接单弹窗）
- [ ] `custom-tab-bar/` Tab 导航
- [ ] `styles/base.wxss` Tab 页底部留白

### M1 — 请 Owner Review 并在此 PR 回复确认

- [ ] `modules/auth/store` + Mock 账号切换（Bob / Alice）
- [ ] `pages/notify/notify.js` 接单通知跳详情
- [ ] `modules/auth/mock-users.js` 测试账号数据

### M3（后续）

- [ ] 云开发 `orders` CRUD 替换 `service.js`  
- [ ] `startTrip`（P1）  
- [ ] 车主「发布行程」副流程（P2）  
- [ ] 移除 §10 Mock 专用逻辑  

### M4

- [ ] Chat 准入：`pending_departure` | `in_progress`  
- [ ] 详情页「进入聊天」入口  

---

## 6. Mock 测试账号

| 账号 | 邮箱 | 身份 | 用途 |
|------|------|------|------|
| Alice | `alice.passenger@disney.com` | 乘客 | 发布、看通知 |
| Bob | `bob.driver@disney.com` | 车主 | 广场接单、完成 |

切换：**我的 → 账号与安全 → Mock 测试账号**

---

## 7. 本地开发注意

- 复制 `miniprogram/config/env.example.js` → `env.js`（不提交 Git）  
- AppID 放 `project.private.config.json`（不提交）；`project.config.json` 保持占位符  
- 微信开发者工具导入 **项目根目录**  

---

## 8. Agent 写代码时请读

1. 对外只 `require('modules/order/index')`，勿 deep require `service.js`  
2. 状态枚举用 `ORDER_STATUS.*`（`matching` 等），UI 文案用 `STATUS_LABELS`  
3. 改契约先 PR + @ 全员（见 COLLABORATION.md）  
4. 顺路/筛选：`plaza-filter.js`、`match.js`、`plaza-sort.js`  

---

## 9. PR 内 Commit 概要

1. `docs(m3-order): align five-state DATA_MODEL and order module scaffold`  
2. `feat(m3-order): plaza accept flow and publish improvements`  
3. `fix(m3-order): complete flow, notifications, and module load order`  

---

## 10. Mock 专用逻辑 · 移除计划（follow-up，不阻塞合并）

| 位置 | 用途 | 移除时机 |
|------|------|----------|
| `app.js` · `PLAZA_ACCEPTED_RESET_VERSION` | 一次性清空已接单 Storage，便于广场自测 | 接云库后删除整块 reset 逻辑 |
| `seed-orders.js` · `refreshPlazaSeedOrders` | 无云库时注入广场种子单 | 云库 `orders` 有数据后改为仅 dev flag |
| `service.js` · `m3_orders_v1` Storage | 本地订单持久化 | 替换为云开发 CRUD |
| `status-machine.js` · `pending_departure` → `completed` | Mock 跳过 `startTrip` | 恢复 UI「出发」后仅保留 `in_progress` → `completed` |
| `modules/auth/mock-users.js` | Bob/Alice 固定测试账号 | 保留至 UAT；生产构建用 env 开关禁用 |

**原则：** 接云库 PR 应同时删除 reset/seed 默认路径，或包在 `env.mockOrders === true` 下。
