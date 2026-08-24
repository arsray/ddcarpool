# 订单状态机 · 操作流转 · 数据结构（跨模块集成指南）

【读者】各模块开发、Cursor / Copilot 等 Agent（写代码、对接口时必读）  
【产品经理】可读第 1、4、6、12 节了解规则与分工；状态流转图请优先看 ORDER_FLOWS_PM.md  
【何时阅读】实现发单 / 接单 / 取消 / Chat、或 Agent 需要字段与状态码时  

【不适合】只关心「页面长什么样」——请看 M1 预览分支或 ORDER_FLOWS_PM.md  

> **Owner**：M1 规则与「我的订单」展示；M3 订单生命周期；M4 Chat；M2 广场 UI。  
> **配套**：[`ORDER_FLOWS_PM.md`](./ORDER_FLOWS_PM.md)（PM 流转图）、[`M1_ORDER_STATES.md`](./M1_ORDER_STATES.md)、[`MODULE_CONTRACTS.md`](./MODULE_CONTRACTS.md)、[`DATA_MODEL.md`](./DATA_MODEL.md)（**v2 存库枚举 · P0 准绳**）。  
> **在线**：https://github.com/arsray/ddcarpool/blob/feat/m1-profile/docs/ORDER_INTEGRATION_GUIDE.md

---

## ⚠️ M3 PR（v2）对齐说明 — **以 `DATA_MODEL.md` v2 为准**

本指南 §2–§5 仍描述 **完整产品愿景**（含车主发布单、双实体 match）。**当前 P0 / Mock 实现** 以 [`DATA_MODEL.md`](./DATA_MODEL.md) v2 与 [`M3_INTEGRATION_STATUS.md`](./M3_INTEGRATION_STATUS.md) 为准：

| 本指南（历史/愿景） | v2 存库枚举（M3 Mock） | UI 中文 |
|---------------------|-------------------------|---------|
| `open` | `matching` | 匹配中 |
| `matched_pre` | `pending_departure` | 待出发 |
| `matched_trip` | `in_progress` | 行程中 |
| `completed` | `completed` | 已完成 |
| `closed` | `closed` | 已关闭 |

**P0 范围（v2）：** 仅 **乘客发单** + **司机广场接单**；无 `createOrder(offer/publish)`、无车主发布锚点单（Post-MVP / P2，见 DATA_MODEL § orders）。

**Mock 缺口（不阻塞本 PR）：** `cancelOrder`、`startTrip` 在 [`MODULE_CONTRACTS.md`](./MODULE_CONTRACTS.md) 已标 **P1**；UI 从 `pending_departure` 直接 `completeOrder`，跳过「出发」步骤。

下文 §1–§14 保留供 M4、车主发布副流程等后续迭代参考；实现 v2 五态时请优先读 DATA_MODEL + MODULE_CONTRACTS。

---

## 1. 一句话业务模型

| 角色 | 能做什么 |
|------|----------|
| **乘车人** | **仅发布**搭车单；**不可接单** |
| **车主** | **接单**（广场浏览里**主动选择**）；**发布车主订单（匹配锚点）见 P2 / Post-MVP** |

**铁律**：匹配 **永不自动完成**——必须由 **车主接受某条乘车人搭车单** 才进入「待出发」。

> **P0（v2 · 本 PR）：** 仅实现乘车人发单 + 车主广场接单；§2 中「车主 · 发布」、§5.2 发布+推荐路径 **未在 Mock 中实现**，字段与状态以 DATA_MODEL v2 单实体 `orders` 为准。

---

## 2. 订单类型（三种业务视角 · 两种底层实体）

实际存储可以是 **一条乘车人搭车单** + 可选 **一条车主发布单**；匹配成功后双方各有一条「视角订单」或共享 `matchId`。

| 业务类型 | 谁创建 | 创建后首态 | 列表入口 | 角标 |
|----------|--------|------------|----------|------|
| **乘车人 · 搭车单** | 乘车人 | `匹配中` | 我的订单 › 乘车人 Tab | — |
| **车主 · 接单** | 车主在广场/推荐里接某搭车单 | `待出发`（**跳过匹配中**） | 我的订单 › 车主 Tab | **接单** |
| **车主 · 发布** | 车主发布自身行程 | `匹配中` | 我的订单 › 车主 Tab | **发布** |

车主 Tab **合并**「接单」与「发布」，用 `createdFrom: 'accept' | 'publish'` 区分，不做两个顶层 Tab。

---

## 3. 统一状态机（5 个一级状态）

### 3.1 底层码 ↔ UI 展示 ↔ v2 存库（M3 Mock）

| 本指南码 | v2 `orders.status` | UI 中文 | M1 预览 `status` | 说明 |
|----------|-------------------|---------|-------------------|------|
| `open` | **`matching`** | **匹配中** | `匹配中` | 广场可见；等待车主接单 |
| `matched_pre` | **`pending_departure`** | **待出发** | `待出发` | 已匹配，出发前 |
| `matched_trip` | **`in_progress`** | **行程中** | `行程中` | 出发后（Mock 可跳过，直接完成） |
| `completed` | **`completed`** | **已完成** | `已完成` | 行程结束 |
| `closed` | **`closed`** | **已关闭** | `已关闭` | 取消 / 停止匹配 / 超时等 |

> **权威来源：** 存库与 API 以 [`DATA_MODEL.md`](./DATA_MODEL.md) v2 为准；上表「本指南码」仅便于对照 §4–§5 历史描述。

### 3.2 状态流转总图

```
                    ┌── 车主接受搭车单 ──┐
                    ▼                    │
[创建] ──→ open(匹配中) ──────────→ matched_pre(待出发)
              │                           │
              │ 取消/停止匹配/超时         │ T-15
              ▼                           ▼
           closed(已关闭)            matched_trip(行程中)
                                          │
                              T+30 / 标记完成
                                          ▼
                                    completed(已完成)

matched_pre / matched_trip ──取消──→ closed(已关闭)
```

**特殊路径**：

- **车主 · 接单**：创建时 **不经过** `open`，直接进入 `matched_pre`（待出发）。
- **车主 · 发布**：创建后进入 `open`（匹配中）；接受某搭车单后 → `matched_pre`，并绑定 `passengerOrderId` / `matchId`。
- **乘车人 · 搭车单**：创建后进入 `open`；可被 **多条车主发布单** 推荐，但 **只有被某车主 accept 后** 才进入 `matched_pre`。

### 3.3 时间窗（待 M3 定时任务 / 云函数）

| 事件 | 建议触发 | 状态变化 |
|------|----------|----------|
| 进入行程 | 出发时间 **T-15** | `matched_pre` → `matched_trip` |
| 完成行程 | 出发时间 **T+30** 或双方确认 | `matched_trip` → `completed` |
| 超时未匹配 | 出发时间到达仍 `open` | `open` → `closed`（`closedReason: 超时未匹配`） |

---

## 4. 操作矩阵（谁能在什么状态做什么）

### 4.1 乘车人 · 搭车单

| 状态 | 用户操作 | 系统效果 | 通知（占位） |
|------|----------|----------|--------------|
| 匹配中 | 编辑 | 更新订单字段 | — |
| 匹配中 | **取消搭车单** | → `closed`，`closedReason: 已取消` | 通知已接单车主（若有） |
| 待出发 | 进入 Chat | 跳转 M4 | — |
| 待出发 | **取消搭车单** | → `closed`；解绑 match | 通知车主 |
| 行程中 | 进入 Chat | 跳转 M4 | — |
| 行程中 | 取消搭车单 | → `closed` | 通知车主 |
| 已完成 | 进入 Chat / 再来一单 | Chat 占位；跳转发布 | — |
| 已关闭 | 再来一单 | 跳转发布页 | — |

### 4.2 车主 · 接单（`createdFrom: accept`）

| 状态 | 用户操作 | 系统效果 |
|------|----------|----------|
| 待出发 | 进入 Chat | 跳转 M4 |
| 待出发 | **取消匹配** | 解绑；搭车单回 `open`；车主侧订单 → `closed`（`已取消接单`） |
| 行程中 | 进入 Chat | 跳转 M4 |
| 已完成 / 已关闭 | 进入 Chat（已完成） | **无「再接一单」** |

### 4.3 车主 · 发布（`createdFrom: publish`）

| 状态 | 用户操作 | 系统效果 |
|------|----------|----------|
| 匹配中 | 查看匹配推荐 | **M3 占位**；仅展示推荐列表，不自动匹配 |
| 匹配中 | 编辑 | 更新发布单 |
| 匹配中 | **停止匹配** | → `closed`，`closedReason: 已停止匹配` |
| 匹配中 | （广场/推荐）**接受搭车单** | 绑定 match → `matched_pre` |
| 待出发 | 进入 Chat | 跳转 M4 |
| 待出发 | **取消匹配** | 见 §4.4 |
| 行程中 | 进入 Chat | 跳转 M4 |
| 已完成 / 已关闭 | 再发一单 | 跳转发布（仅 publish 来源） |

### 4.4 取消匹配（车主 · 待出发）— 已定稿交互

统一 **单弹窗** `showModal`，标题「取消匹配」，按钮 **取消匹配 / 取消**。

| 场景 | 弹窗正文 | 确认后 |
|------|----------|--------|
| `hasPublishTrip: true`（有关联发布单） | 将取消与对方的同行匹配。您发布的车主订单将继续匹配。 | 解绑 match；**发布单回 `open`（匹配中）**；搭车单回 `open` |
| `hasPublishTrip: false`（纯接单） | 将取消与对方的同行匹配。 | 解绑 match；搭车单回 `open`；车主接单记录 → `closed` |

**关闭发布单** 仅能通过 **停止匹配**（匹配中），不在取消匹配弹窗提供。

### 4.5 停止匹配（车主 · 发布 · 匹配中）

- 正文：该车主订单将被关闭。
- 按钮：停止匹配 / 取消

---

## 5. 匹配与接单（M3 必实现）

### 5.1 主路径（广场）

```
乘车人 createOrder(seek)  →  open（匹配中）→ 广场 listOpenOrders 可见
车主 browse 广场           →  acceptOrder(passengerOrderId)
双方                       →  matched_pre（待出发）
```

### 5.2 次级路径（发布 + 推荐）

```
车主 createOrder(publish/offer)  →  open（匹配中，仅作锚点）
M3 匹配推荐（后续）               →  返回可接搭车单列表（不改状态）
车主从推荐/广场 choose 一条       →  acceptOrder（同主路径）
发布单 + 被选搭车单              →  matched_pre，建立 match 关系
```

### 5.3 `acceptOrder` 语义（建议 M3 接口）

```js
/**
 * 车主接受一条乘车人搭车单
 * @param {string} passengerOrderId - 乘车人搭车单 ID
 * @param {object} ownerContext
 * @param {string} [ownerContext.publishOrderId] - 若从发布单上下文接单
 * @param {'accept'|'publish'} ownerContext.createdFrom
 */
acceptOrder(passengerOrderId, ownerContext)
```

**原子事务内应完成**：

1. 校验搭车单为 `open`
2. 校验车主身份与余座（若有 publish 单）
3. 搭车单 → `matched_pre`，写入 `ownerOpenId` / `ownerName`
4. 创建或更新车主视角订单 → `matched_pre`
5. 若有 `publishOrderId`：发布单 → `matched_pre`，`hasPublishTrip: true`
6. 纯广场接单：车主订单 `createdFrom: 'accept'`，`hasPublishTrip: false`
7. 写 `matchedAt`，发通知（M1 占位 `triggerCancelNotify` / 后续通知模块）

---

## 6. 数据结构

### 6.1 M1 预览模型（`modules/auth/mock.js` · 当前前端 Mock）

用于「我的订单」列表/详情，**M3 返回数据需能映射到此视图**。

#### 乘车人搭车单 `PassengerOrderView`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 订单 ID |
| `from` | string | 是 | 起点展示名 |
| `to` | string | 是 | 终点展示名 |
| `dateLabel` | string | 否 | 如 `8月13日 周三` |
| `timeLabel` | string | 否 | 如 `17:00` |
| `sortAt` | number | 否 | 排序权重（时间戳） |
| `status` | string | 是 | 五态中文，见 §3.1 |
| `count` | number | 是 | 乘车人数 |
| `note` | string | 否 | 备注 |
| `partnerName` | string | 否 | 匹配后车主昵称 |
| `closedReason` | string | 否 | 已关闭二级文案 |

#### 车主订单 `OwnerOrderView`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | 车主侧订单 ID |
| `from` / `to` | string | 是 | 路线 |
| `dateLabel` / `timeLabel` / `sortAt` | — | 否 | 同乘车人 |
| `status` | string | 是 | 五态中文 |
| `createdFrom` | `'publish' \| 'accept'` | 是 | 角标来源 |
| `hasPublishTrip` | boolean | 是 | 是否有关联发布单（影响取消匹配逻辑） |
| `capacity` | number | 否 | 可载人数（匹配中 publish 展示） |
| `count` | number | 否 | 已匹配乘客人数 |
| `partnerName` | string | 否 | 乘客昵称 |
| `note` | string | 否 | 备注 |
| `closedReason` | string | 否 | 已关闭二级 |

#### 示例（测试数据）

```json
{
  "id": "p-waiting",
  "from": "PAB",
  "to": "TD",
  "status": "待出发",
  "count": 1,
  "partnerName": "Ray Gong"
}
```

```json
{
  "id": "o-waiting-publish",
  "from": "PAB",
  "to": "TD",
  "status": "待出发",
  "createdFrom": "publish",
  "hasPublishTrip": true,
  "count": 1,
  "partnerName": "Liz Sun"
}
```

### 6.2 建议 M3 云库 `orders` 扩展（相对 `DATA_MODEL.md`）

在现有 `orders` 集合上 **建议增加**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `role` | `'passenger' \| 'owner'` | 视角（或拆 collection） |
| `orderKind` | `'seek' \| 'offer' \| 'owner_accept'` | seek=搭车单；offer=发布单；owner_accept=接单生成 |
| `phase` | `'open' \| 'matched_pre' \| 'matched_trip' \| 'completed' \| 'closed'` | 对应 §3.1 底层码 |
| `createdFrom` | `'publish' \| 'accept'` | 车主订单来源 |
| `hasPublishTrip` | boolean | 是否绑定发布单 |
| `publishOrderId` | string | 关联发布单 ID |
| `passengerOrderId` | string | 关联搭车单 ID |
| `matchId` | string | 一次匹配会话 ID（Chat 绑定） |
| `passengerCount` | number | 人数 |
| `capacity` | number | 车主可载 |
| `closedReason` | string | 二级关闭原因 |
| `ownerOpenId` / `passengerOpenId` | string | 参与者 |

**状态枚举迁移表**（旧 → 新）：

| 旧 `DATA_MODEL` | 新 `phase` |
|-----------------|------------|
| `open` | `open` |
| `matched` | `matched_pre` 或 `matched_trip`（需拆分） |
| `completed` | `completed` |
| `cancelled` | `closed` |

### 6.3 匹配关系（逻辑模型）

```
Match {
  matchId: string
  passengerOrderId: string
  ownerOrderId: string        // 车主视角订单
  publishOrderId?: string      // 若从发布单接单
  status: 'active' | 'cancelled'
  matchedAt: Date
}
```

一次匹配 = 1 条搭车单 + 1 条车主参与记录；Chat 的 `orderId` 建议用 **`matchId`** 或 **`passengerOrderId`**（M3/M4 联调时二选一并写死）。

---

## 7. UI 展示约定（M2 / M1 已实现 · M3 供数即可）

### 7.1 列表行结构

```
路线：604 → 603
第二行：[状态 Tag] · 8月13日 周三 · 17:00
第三行：二级文案（见下）
右上角（仅车主）：[发布] 或 [接单]
```

### 7.2 二级文案（`order-display.js`）

| 状态 | 乘车人列表 | 车主列表 |
|------|------------|----------|
| 匹配中 | 等待车主接单 | 等待匹配 |
| 待出发 | 车主 {name} 已接单 | 乘客 {name} {n} 人 |
| 行程中 | 车主 {name} · 同行 | 乘客 {name} {n} 人 · 同行 |
| 已关闭 | `{closedReason}` | `{closedReason}` |
| 已完成 | （无） | （无） |

### 7.3 详情页

- 导航标题：**乘车人订单详情** / **车主订单详情**
- 首行：**状态 Tag + 二级文案**（同色 Tag，灰色副文案）
- 字段块：出发 → 路线 → 可载/人数 → 备注
- 操作按钮：见 §8

### 7.4 Filter（四档）

`全部 | 未完成 | 已完成 | 已关闭`

| Filter | 包含状态 |
|--------|----------|
| 未完成 | 匹配中 + 待出发 + 行程中 |
| 已完成 | 已完成 |
| 已关闭 | 已关闭 |

---

## 8. 详情页按钮（`order-actions.js` · M1 已实现）

| 视角 | 状态 | 按钮 |
|------|------|------|
| 乘车人 | 匹配中 | 编辑 \| 取消搭车单 |
| 乘车人 | 待出发 | 进入 Chat \| 取消搭车单 |
| 乘车人 | 行程中 | 进入 Chat |
| 乘车人 | 已完成 | 进入 Chat \| 再来一单 |
| 乘车人 | 已关闭 | 再来一单 |
| 车主 | 匹配中 | 查看匹配推荐 \| 编辑 \| 停止匹配 |
| 车主 | 待出发 | 进入 Chat \| 取消匹配 |
| 车主 | 行程中 | 进入 Chat |
| 车主 | 已完成（publish） | 进入 Chat \| 再发一单 |
| 车主 | 已完成（accept） | 进入 Chat |
| 车主 | 已关闭（publish） | 再发一单 |

危险操作（红色）：`停止匹配`、`取消搭车单`、`取消匹配`。

---

## 9. Chat 集成（M4）

| 规则 | 说明 |
|------|------|
| 入口状态 | **待出发、行程中、已完成** 显示「进入 Chat」（M1 占位） |
| 完成后再聊 | 已完成/已关闭 **仍可进 Chat 至次日失效**（细则 M4 定） |
| 发送权限 | 参与者双方（`publisherOpenId` + 对手方 openId） |
| 旧约束 | `DATA_MODEL` 写「仅 matched 可发消息」→ 需扩展为 `matched_pre` / `matched_trip` / 完成窗口内 |

**建议 M4 接口**：

```js
canEnterChat(order, currentOpenId)  // phase in [matched_pre, matched_trip] 或 completed 且在窗口内
listMessages(matchId | orderId)
sendMessage(matchId | orderId, content)
```

---

## 10. 通知钩子（M1 占位 · 后续通知模块）

| 事件 | 建议 payload |
|------|--------------|
| 车主接单 | `{ type: 'matched', ownerOrderId, passengerOrderId }` |
| 取消搭车单 / 取消匹配 | `{ type: 'order_cancel_requested', orderId, role }` |
| 停止匹配 | `{ type: 'publish_stopped', publishOrderId }` |
| 行程完成 | `{ type: 'completed', matchId }` |

M1 当前：`history-detail.js` → `triggerCancelNotify()` 仅 `console.info` 占位。

---

## 11. 模块分工与文件索引

| 模块 | 职责 | 关键路径 |
|------|------|----------|
| **M3 order** | create / listOpen / accept / cancel / complete / 匹配推荐 | `modules/order/`（待建） |
| **M2 广场** | 展示 open 订单、筛选 | `pages/index/` |
| **M3 发布** | 创建 seek / offer | `pages/publish/` |
| **M1 我的订单** | 列表、详情、按钮、Mock | `pages/history*`, `modules/auth/order-*.js` |
| **M4 chat** | 消息 | `pages/chat/`, `modules/chat/` |

**M1 已实现（Mock 预览）**：

| 文件 | 内容 |
|------|------|
| `modules/auth/order-status.js` | 五态常量、Filter 映射 |
| `modules/auth/order-actions.js` | 详情按钮规则 |
| `modules/auth/order-display.js` | 列表/详情文案 |
| `modules/auth/mock.js` | 种子测试订单 |

---

## 12. 集成检查清单（Agent 可直接当 TODO）

**P0 / Mock（`feat/m3-from-main`）— 以 DATA_MODEL v2 为准：**

- [x] **M3** `createOrder` → 乘客单 `status=matching`
- [x] **M3** `listOpenOrders` 仅返回 `matching` 且未过期（广场）
- [x] **M3** `acceptOrder` → `pending_departure`
- [x] **M3** `completeOrder`（Mock 允许 `pending_departure` → `completed`，跳过 `startTrip`）
- [x] **M3** `expireStaleOrders`：`matching` 过期 → `closed`
- [ ] **M3** `cancelOrder`（P1）
- [ ] **M3** `startTrip`（P1）
- [ ] **M3** `createOrder(offer/publish)` 车主发布锚点（P2 / Post-MVP）
- [ ] **M4** `canEnterChat`：`pending_departure` | `in_progress`
- [ ] **M1** 我的订单五态与 order 模块同步

**完整愿景（含车主发布单 · 后续迭代）：**

- [ ] **M3** `createOrder(offer/publish)` → 车主发布单，§5.2 推荐路径
- [ ] **M3** `cancelOrder` / `stopMatching` 实现 §4 矩阵
- [ ] **M3** 取消匹配时：publish 单回 `matching`，seek 单回 `matching`
- [ ] **M3** 定时/触发：`pending_departure`→`in_progress`→`completed`
- [ ] **M4** Chat 绑定 `matchId` 或统一 `orderId` 策略
- [ ] **CP3** 已匹配订单可进 Chat（见 `MODULE_CONTRACTS.md`）

---

## 13. 已关闭 · 二级原因枚举

| 视角 | `closedReason` 示例 |
|------|-------------------|
| 乘车人 | 已取消、超时未匹配、匹配后取消 |
| 车主 · 接单 | 已取消接单、对方已取消 |
| 车主 · 发布 | 已停止匹配、超时无匹配、已取消 |

---

## 14. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-08-13 | 初版产品讨论 → `M1_ORDER_STATES.md` |
| 2026-08-13 | M1 预览实现 Mock + 列表/详情 UI |
| 2026-08-24 | **v2 对齐**：顶部注明 DATA_MODEL v2 为准；§3.1 映射 `matching` 等；§12 拆分 P0 Mock vs 愿景清单 |

---

**分享方式**：将本文链接或 `docs/ORDER_INTEGRATION_GUIDE.md` 发给对应模块。**M3 PR / Mock 实现以 `docs/DATA_MODEL.md` v2 为存库准绳**；本文 §2–§5 车主发布等愿景段落供后续迭代对照。
