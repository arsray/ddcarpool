# 数据模型

云开发数据库集合定义。字段变更需 PR 更新本文档，并 @ 所有模块负责人 Review。

> **v2（M3 PR）** 与 [`ORDER_FLOWS_PM.md`](./ORDER_FLOWS_PM.md) / 产品 PRD v1.1 **五态**对齐，替代原 `open / matched / completed / cancelled` 四态。  
> M1 Mock 文案请改用下文 **STATUS_LABELS**；M4 聊天准入状态见 **§ orders · 聊天准入**。

## 集合一览

| 集合 | Owner | 说明 |
|------|-------|------|
| `users` | M1 | 用户资料 |
| `orders` | **M3** | 乘客搭车订单（P0 仅乘客发单 + 司机接单） |
| `points` | **M3** | 预设 POI（无数据时用 `modules/order/constants/points.js`） |
| `configured_routes` | **M3** | 顺路计算用配置路线（无数据时用 `constants/routes.js`） |
| `notifications` | 维护者 | 当前用户站内通知 |
| `messages` | M4 | 订单聊天（P1） |
| `email_verifications` | 维护者 | 邮箱验证码摘要、限流和使用状态 |

---

## 常量：订单状态（全项目统一）

**代码枚举（存库 `orders.status`）** ↔ **中文（UI）**

| status | 中文 | 广场可见 | 说明 |
|--------|------|:--------:|------|
| `matching` | 匹配中 | ✓ | 乘客已发单，等待司机接单 |
| `pending_departure` | 待出发 | ✗ | 司机已接单 |
| `in_progress` | 行程中 | ✗ | 已出发 |
| `completed` | 已完成 | ✗ | 正常结束 |
| `closed` | 已关闭 | ✗ | 取消或过期 |

```js
// miniprogram/modules/order/constants/status.js（M3 维护，M1/M2 可 import 展示文案）

export const ORDER_STATUS = {
  MATCHING: 'matching',
  PENDING_DEPARTURE: 'pending_departure',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CLOSED: 'closed',
};

export const STATUS_LABELS = {
  matching: '匹配中',
  pending_departure: '待出发',
  in_progress: '行程中',
  completed: '已完成',
  closed: '已关闭',
};

/** 我的订单 · 筛选 Tab */
export const FILTER_BUCKETS = {
  open: ['matching', 'pending_departure', 'in_progress'],
  completed: ['completed'],
  closed: ['closed'],
};
```

### 关闭原因（`orders.closeReason`，仅 `status === closed`）

| closeReason | 说明 |
|-------------|------|
| `cancelled_by_passenger` | 乘客取消 |
| `cancelled_by_driver` | 司机取消（待出发阶段） |
| `expired` | 超过 `departTime` 仍为匹配中 |

---

## users

`openId` 只能由云函数从微信上下文写入。客户端提交的 openId 不参与身份判断。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `openId` | string | 是 | 真实微信 openid，唯一索引 |
| `email` | string | 否 | 标准化公司邮箱 |
| `emailVerified` | boolean | 是 | 仅 SMTP 服务端校验成功时为 true |
| `emailVerificationMode` | string | 否 | `smtp` 或仅开发使用的 `mock` |
| `displayName` / `nickName` | string | 否 | 展示名 |
| `avatarUrl` / `phone` / `department` | string | 否 | Profile |
| `identities` | string[] | 是 | `owner` / `passenger` |
| `userMode` | string | 是 | 当前 UI 模式 |
| `onboardingComplete` | boolean | 是 | 是否完成引导 |
| `vehicle` / `preference` | object | 否 | 车辆与乘车偏好 |
| `habitTags` | string[] | 否 | 习惯标签 |
| `createdAt` / `updatedAt` | Date | 是 | 服务端时间 |

权限：仅云函数可读写。

---

## orders

P0 仅支持 **乘客发布搭车单**；司机通过 **接单** 参与，不单独发 `offer` 类型（车主先发行程见 P2，Post-MVP）。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `_id` | string | 自动 | 文档 ID |
| `fromPointId` | string | 是 | 起点 POI（`points.pointId`） |
| `toPointId` | string | 是 | 终点 POI |
| `departTime` | string | 是 | 出发时间 `YYYY-MM-DD HH:mm`（本地/业务时区，团队统一） |
| `departTimeEnd` | string | 是 | 时间窗结束 `HH:mm` |
| `departTimeAt` | Date | 是 | 按 UTC+8 解析的可查询开始时间 |
| `departTimeEndAt` | Date | 是 | 按 UTC+8 解析的可查询结束时间 |
| `passengerCount` | number | 是 | 出行人数，≥1 |
| `note` | string | 否 | 备注，≤100 字（与 `validate.js` · `MAX_NOTE_LENGTH` 一致） |
| `status` | string | 是 | 见上表 |
| `closeReason` | string | 否 | 仅 `closed` |
| `passengerOpenId` | string | 是 | 乘客 openId（发布者） |
| `passengerName` | string | 否 | 乘客展示名（冗余，列表用） |
| `driverOpenId` | string | 否 | 接单司机 openId |
| `driverName` | string | 否 | 司机展示名 |
| `driverVehicle` | object | 否 | 接单时**服务端**快照的车辆信息（不信任客户端）；见下表 |
| `matchedAt` | Date | 否 | 接单时间 |
| `startedAt` | Date | 否 | 进入行程中时间 |
| `completedAt` | Date | 否 | 完成时间 |
| `closedAt` | Date | 否 | 关闭时间 |
| `matchScore` | number | 否 | **列表展示用**；广场排序时可由 M3 按查看者上下文计算，可不落库 |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

### `orders.driverVehicle`（接单快照）

由 `order` 云函数 `acceptOrder` 从司机 `users.vehicle` 写入，客户端不可直接 patch。

| 字段 | 类型 | 说明 |
|------|------|------|
| `brand` | string | 品牌型号 |
| `plate` | string | 车牌（完整或拼接后） |
| `color` | string | 颜色 |

乘客详情页展示车主卡片时优先读此快照；`pending_departure` / `in_progress` / `completed` 且已接单时可见。司机取消接单（`release`）时服务端清除 `driverVehicle`。

**索引建议**

- `status` + `departTime`（广场：`matching` 且未过期）
- `passengerOpenId` + `createdAt`
- `driverOpenId` + `createdAt`

**权限**

- 客户端不可直接读写；所有操作经 `order` 云函数。
- 广场仅由云函数返回未过期的 `matching` 订单。
- 已匹配订单仅参与者可读，写操作按下方状态表授权。
- 接单、重叠检查和通知写入在服务端事务中完成。

### 状态流转（P0 · 乘客搭车单 + 司机广场接单）

```
matching ──司机接单──→ pending_departure ──出发──→ in_progress ──完成──→ completed
    │                         │
    ├──乘客取消 / 过期──────────┼──取消──→ closed
    │                         │
    └─────────────────────────┘
```

**合法操作（P0）**

| 当前 status | 操作 | 执行者 | 新 status | 备注 |
|-------------|------|--------|-----------|------|
| `matching` | 接单 accept | 司机（≠ passengerOpenId） | `pending_departure` | 写 driver*、matchedAt；**M1 通知乘客** |
| `matching` | 取消 cancel | 乘客 | `closed` | closeReason=`cancelled_by_passenger` |
| `matching` | 过期 expire | 系统 | `closed` | `departTime` 已过；closeReason=`expired` |
| `pending_departure` | 出发 start | 司机 | `in_progress` | 写 startedAt；或到点自动触发（实现二选一，PRD 允许） |
| `pending_departure` | 完成 complete | 司机或乘客 | `completed` | **Mock 短路**：本 PR UI 未暴露 `startTrip`，允许直接完成 |
| `pending_departure` | 取消 cancel | 乘客 | `closed` | closeReason=`cancelled_by_passenger` |
| `pending_departure` | 取消匹配 release | 司机 | `matching` | 清空 driver*、matchedAt；搭车单回广场；**非 closed** |
| `in_progress` | 完成 complete | 司机或乘客 | `completed` | 写 completedAt；**P0 行程中不可取消** |
| `in_progress` | 取消 | — | — | **不允许** |

### 聊天准入（M4 · P1）

仅当 `status ∈ { pending_departure, in_progress }` 且当前 openId 为 `passengerOpenId` 或 `driverOpenId`。

---

## points

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `_id` | string | 自动 | 文档 ID |
| `pointId` | string | 是 | 业务 ID，如 `parking-a` |
| `name` | string | 是 | 显示名称 |
| `sortOrder` | number | 是 | 排序 |
| `enabled` | boolean | 否 | 默认 true |

默认种子见 `miniprogram/modules/order/constants/points.js`。

---

## configured_routes

供 **P0-03 顺路计算**；M3 `match.js` 读取。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `_id` | string | 自动 | 文档 ID |
| `routeId` | string | 是 | 如 `backstage-main` |
| `name` | string | 是 | 展示名 |
| `pointIds` | string[] | 是 | POI 有序序列（顺路走廊） |
| `enabled` | boolean | 否 | 默认 true |

**顺路度（P0 算法约定）**

1. 若订单 `from`→`to` 均在某条 `pointIds` 路径上且顺序正确 → 高分  
2. 若仅部分 POI 重合 → 中分  
3. 无配置覆盖 → 低分/0；列表仍展示，后台告警补配置  

---

## messages

（M4 维护，此处不变；`matched` 改为 `pending_departure | in_progress` 准入）

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `_id` | string | 自动 | 文档 ID |
| `orderId` | string | 是 | 关联 `orders._id` |
| `senderOpenId` | string | 是 | 发送者 |
| `senderName` | string | 否 | 昵称 |
| `content` | string | 是 | 正文 |
| `createdAt` | Date | 是 | 发送时间 |

消息按 `(orderId, createdAt)` 游标分页，每页最多 50 条；客户端不可直接读写。

---

## notifications

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `_id` | string | 自动 | 文档 ID |
| `recipientOpenId` | string | 是 | 接收者 |
| `title` | string | 是 | 通知文案 |
| `targetId` | string | 是 | 订单 ID |
| `targetType` | string | 是 | `passenger` / `owner` |
| `read` | boolean | 是 | 已读状态 |
| `createdAt` / `readAt` | Date | 是/否 | 服务端时间 |

仅接收者可通过 `notification` 云函数列表和标记已读。

---

## email_verifications

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `openId` | string | 是 | 请求者真实微信 openid |
| `emailNormalized` | string | 是 | 标准化公司邮箱 |
| `codeDigest` | string | 是 | HMAC-SHA256 摘要，不保存明文 |
| `createdAtMs` / `expiresAtMs` | number | 是 | 限流与过期判断 |
| `attempts` | number | 是 | 校验失败次数，最多 5 次 |
| `used` | boolean | 是 | 单次使用标记 |
| `createdAt` / `usedAt` | Date | 是/否 | 服务端时间 |

权限：仅 `emailAuth` 云函数读写。验证码 10 分钟有效、60 秒发送冷却。

---

## 云函数

| 云函数 | Owner | 说明 |
|--------|-------|------|
| `login` | 维护者 | 真实 openid 与当前用户状态 |
| `user` | 维护者 | Profile、身份、车辆与偏好 |
| `emailAuth` | 维护者 + M1 SMTP | 验证码摘要、限流、校验和发信适配 |
| `order` | 维护者 | 订单 CRUD、事务化接单、状态迁移和过期任务 |
| `notification` | 维护者 | 当前用户通知和已读状态 |
| `message` | 维护者 | 参与者聊天与分页 |
| `seedConfig` | 维护者 | 管理员幂等导入 POI / 路线 |

---

## 迁移说明（自 v1 四态）

| 旧 status | 新 status |
|-----------|-----------|
| `open` | `matching` |
| `matched` | `pending_departure` |
| `completed` | `completed` |
| `cancelled` | `closed` |

删除字段：`type`（`seek`/`offer`）、`publisherOpenId` → 重命名为 `passengerOpenId`，`accepterOpenId` → `driverOpenId`，`seats` → `passengerCount`（乘客单）。

---

**变更记录**

| 版本 | 日期 | 说明 |
|------|------|------|
| v2.1 | 2026-08-24 | 备注 ≤100 字；Mock 允许 `pending_departure` 直接 complete |
| v2 | 2026-08-17 | M3 PR：五态、passengerCount、configured_routes、对齐 PRD v1.1 |
