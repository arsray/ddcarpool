# 数据模型

云开发数据库集合定义。字段变更需 PR 更新本文档，并通知所有模块负责人。

> **Mock 阶段（当前 M1 PR）**  
> 「我的订单」预览使用 `modules/auth/mock.js` 五态中文文案，**尚未与本文 `orders.status` 四枚举对齐**。  
> 五态状态机、字段扩展建议见 [`ORDER_INTEGRATION_GUIDE.md`](./ORDER_INTEGRATION_GUIDE.md)。  
> **与 @M3 @M4 确认后**，由 M3 主导更新本节与云库实现；本 PR **不修改** 云库四态定义为最终方案。

## 集合一览

| 集合 | Owner | 说明 |
|------|-------|------|
| `users` | M1 | 用户资料 |
| `orders` | M3 | 订单（蹭车/捎带） |
| `points` | M3 | 固定点位（可选，无则用代码内默认值） |
| `messages` | M4 | 订单聊天消息 |

## users

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 文档 ID |
| `openId` | string | 是 | 微信 openid，业务主键 |
| `nickName` | string | 否 | 昵称 |
| `avatarUrl` | string | 否 | 头像 URL |
| `department` | string | 否 | 部门（Post-MVP 可必填） |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

**索引建议**：`openId` 唯一索引

**权限建议**：仅创建者可读写

## orders

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 文档 ID |
| `type` | string | 是 | `seek` 求蹭车 / `offer` 可捎带 |
| `fromPointId` | string | 是 | 起点 ID |
| `toPointId` | string | 是 | 终点 ID |
| `departTime` | string | 是 | 出发时间，格式 `YYYY-MM-DD HH:mm` |
| `seats` | number | 否 | 可带人数，仅 `offer` 类型，默认 1 |
| `note` | string | 否 | 备注，最长 200 字 |
| `status` | string | 是 | 见下方状态枚举 |
| `publisherOpenId` | string | 是 | 发布者 openId |
| `publisherName` | string | 否 | 发布者昵称（冗余，便于列表展示） |
| `accepterOpenId` | string | 否 | 接取者 openId |
| `accepterName` | string | 否 | 接取者昵称 |
| `matchedAt` | Date | 否 | 匹配时间 |
| `createdAt` | Date | 是 | 创建时间 |
| `updatedAt` | Date | 是 | 更新时间 |

### 订单状态枚举

| status | 中文 | 说明 |
|--------|------|------|
| `open` | 待接取 | 初始状态，广场可见 |
| `matched` | 已匹配 | 已被接取，可进入聊天 |
| `completed` | 已完成 | 行程结束 |
| `cancelled` | 已取消 | 发布者或接取者取消 |

### 状态流转

```
open ──接取──→ matched ──完成──→ completed
 │                │
 └──取消──→ cancelled ←──取消──┘
```

**合法操作**

| 当前状态 | 操作 | 执行者 | 新状态 |
|----------|------|--------|--------|
| open | 接取 | 非发布者 | matched |
| open | 取消 | 发布者 | cancelled |
| matched | 完成 | 发布者或接取者 | completed |
| matched | 取消 | 发布者或接取者 | cancelled |

**权限建议**：所有用户可读 `status=open` 的订单；其余字段按参与者读写（M3 实现时在云函数或规则中 enforce）

## points

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 文档 ID |
| `pointId` | string | 是 | 业务 ID，如 `parking-a` |
| `name` | string | 是 | 显示名称 |
| `sortOrder` | number | 是 | 排序 |
| `enabled` | boolean | 否 | 是否启用，默认 true |

**默认点位**（无 `points` 集合数据时使用，M3 维护于 `modules/order/constants.js`）：

| pointId | name |
|---------|------|
| `parking-a` | 停车场 A 区 |
| `parking-b` | 停车场 B 区 |
| `metro-11` | 11 号线迪士尼站 |
| `cast-gate` | 演职人员通道 |
| `office-tower` | 行政办公楼 |
| `hotel-shdr` | 度假区酒店区 |

## messages

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `_id` | string | 自动 | 文档 ID |
| `orderId` | string | 是 | 关联订单 `_id` |
| `senderOpenId` | string | 是 | 发送者 openId |
| `senderName` | string | 否 | 发送者昵称 |
| `content` | string | 是 | 消息正文 |
| `createdAt` | Date | 是 | 发送时间 |

**约束**

- 仅 `orders.status === 'matched'` 时可发送消息
- 发送者必须是该订单的 `publisherOpenId` 或 `accepterOpenId`

**索引建议**：`orderId` + `createdAt`

**权限建议**：通过云函数写入；读取限订单参与者

## 云函数（规划）

| 云函数 | Owner | 说明 |
|--------|-------|------|
| `login` | M1 | 返回 openid |
| `order` | M3 | 接取/取消/完成等需校验状态的操作（可选，也可客户端+规则） |
| `message` | M4 | 发送消息并校验权限（建议） |
