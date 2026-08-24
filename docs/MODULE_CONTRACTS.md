# 模块接口契约

跨模块调用必须通过本文档定义的接口，禁止直接读写其他模块的内部文件。

## 全局约定

### 身份与全局状态（`App.globalData` · M1 Mock 预览）

登录态与 Profile 预览数据由 `modules/auth/store.js` 同步至 `globalData`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `openId` | string \| null | Mock openId（邮箱派生） |
| `userProfile` | object \| null | `{ openId, nickName, avatarUrl, department, email }` |
| `userInfo` | object \| null | Mock 登录用户 `{ email, displayName, phone, department }` |
| `userMode` | `'owner' \| 'passenger'` | 当前 Profile 模式 |
| `identities` | string[] | 已开通身份 `owner` / `passenger` |
| `onboardingComplete` | boolean | 是否完成首次引导 |
| `vehicle` | object \| null | 车辆信息 |
| `preference` | object \| null | 乘车偏好 |
| `habitTags` | string[] | 习惯标签 |
| `historyOwner` | array | 车主订单 Mock 列表 |
| `historyPassenger` | array | 乘车人订单 Mock 列表 |
| `notifications` | array | 通知 Mock 列表 |

`App` 实例方法（M1 页面可调用，**非** `modules/auth` 契约 export）：

| 方法 | 说明 |
|------|------|
| `_syncAuth()` | 内部：store → globalData |
| `loginWithEmail(email)` | Mock 登录 |
| `routeAfterLogin()` | 登录后跳 onboarding 或「我的」 |
| `logout()` | 退出 |
| `setUserMode(mode)` | 切换车主/乘车人模式 |
| `addIdentity(role)` | 添加身份 |
| `completeOnboarding()` | 完成引导 |
| `saveVehicle` / `savePreference` / `saveHabitTags` | 保存 Profile |
| `hasIdentity(role)` / `getMissingIdentity()` | 身份查询 |

跨模块请使用 **`modules/auth/index.js` 导出函数**，勿直接依赖 `store`（Mock 阶段页面仍有历史引用，后续收敛）。

### 错误处理

模块 exported 函数：

- 成功：返回数据或 `{ ok: true, data }`
- 失败：`throw new Error('ERROR_CODE')` 或返回 `{ ok: false, code, message }`

各模块在 README 中维护错误码表。

---

## M1 — auth 模块

**路径**：`miniprogram/modules/auth/`

### 导出接口（M1 实现）

```js
// miniprogram/modules/auth/index.js

/**
 * 确保已登录，返回 openId
 * @returns {Promise<string>}
 */
ensureLogin()

/**
 * 获取本地缓存的用户资料，无则返回 null
 * @returns {Promise<User|null>}
 */
getProfile()

/**
 * 请求微信授权并 upsert 用户资料
 * @returns {Promise<User>}
 */
requestProfile()

/**
 * 当前用户的订单列表（我发布 + 我接取）
 * @returns {Promise<Order[]>}
 */
listMyOrders()

/**
 * 确保已登录；未登录 reLaunch 登录页
 * @returns {boolean}
 */
requireLogin()

/**
 * 详情页操作按钮（Mock 规则，M3 接真数据后仍可用）
 */
statusActions(order, role)

/**
 * 是否危险操作（停止匹配、取消等）
 */
isDangerAction(action)
```

> **Mock 阶段说明**：`store`、`order-status`、`order-display` 等 **未** 列入上表正式 export；M3 接真订单后 M1 改为调 `listMyOrders()` 与 M3 状态枚举。

### 依赖

- 云函数 `login`
- 集合 `users`

### 被依赖

- M3：创建/接取订单时需要 `openId` 与 `nickName`
- M4：发消息时需要 `openId` 与 `nickName`
- M2：主页可选展示登录态

---

## M3 — order 模块

**路径**：`miniprogram/modules/order/`  
**Owner**：M3

**职责（P0）**：乘客创建订单、司机广场接单、POI/配置路线、顺路排序、订单状态机、过期关闭。

### 导出接口

实现文件：`miniprogram/modules/order/index.js`

| 函数 | 优先级 | 说明 |
|------|--------|------|
| `listOpenOrders(options)` | P0 | 广场：`matching` + 未过期；默认 `matchScore` 降序 |
| `createOrder(input)` | P0 | 乘客发单 → `matching` |
| `acceptOrder(orderId, driver)` | P0 | 司机接单 → `pending_departure` |
| `cancelOrder(orderId, options)` | P1 | 取消 → `closed`（Mock 未实现，见 [`M3_INTEGRATION_STATUS.md`](./M3_INTEGRATION_STATUS.md)） |
| `expireStaleOrders()` | P0 | `matching` 且过点 → `closed` |
| `startTrip(orderId, actorOpenId)` | P1 | → `in_progress`（Mock 未实现；本 PR UI 从 `pending_departure` 直接 `completeOrder`） |
| `completeOrder(orderId, actorOpenId)` | P0 | → `completed` |
| `getOrderById(orderId)` | P0 | 详情 |
| `listOrdersForUser(openId, filters)` | P0 | 我的订单（M1 可转调） |
| `listPoints()` | P0 | POI 列表 |
| `listConfiguredRoutes()` | P0 | 顺路配置 |
| `formatRoute(fromPointId, toPointId, points?)` | P0 | `A → B` 文案 |
| `computeMatchScore(order, context?)` | P0 | 顺路分 |

### 类型（CreateOrderInput）

| 字段 | 类型 | 必填 |
|------|------|:----:|
| `fromPointId` | string | ✓ |
| `toPointId` | string | ✓ |
| `departTime` | string | ✓ |
| `passengerCount` | number | ✓ |
| `note` | string | |
| `passengerOpenId` | string | ✓ |
| `passengerName` | string | |

订单 `status` 枚举见 [`DATA_MODEL.md`](./DATA_MODEL.md) v2：`matching` | `pending_departure` | `in_progress` | `completed` | `closed`

### 错误码

| code | 说明 |
|------|------|
| `NOT_IMPLEMENTED` | 接口占位，M3 实现中 |
| `INVALID_DEPART_TIME` | 不在 7 日窗 |
| `INVALID_POI` | POI 无效 |
| `OVERLAPPING_ORDER` | 重叠时间窗已有有效单 |
| `ORDER_NOT_FOUND` | 订单不存在 |
| `INVALID_STATUS` | 状态不允许该操作 |
| `SELF_ACCEPT` | 不能接自己的单 |
| `ALREADY_ACCEPTED` | 已被接单 |
| `TRIP_IN_PROGRESS_NO_CANCEL` | 行程中不可取消 |

### 依赖

- M1：`ensureLogin()` → openId、展示名

### 被依赖

- M2：`listOpenOrders`、`formatRoute`
- M1：`listOrdersForUser`；接单后通知
- M4（P1）：`getOrderById` + 聊天准入状态

### order-card 数据约定（M2）

`properties.order` 至少包含：`_id`, `status`, `statusLabel`, `routeLabel`, `departTime`, `passengerCount`, `passengerName`, `driverName`, `matchScore`

---

## M4 — chat 模块

**路径**：`miniprogram/modules/chat/`

### 导出接口（M4 实现）

```js
// miniprogram/modules/chat/index.js

/**
 * 是否可进入聊天
 * @param {Order} order
 * @param {string} currentOpenId
 * @returns {boolean}
 */
canEnterChat(order, currentOpenId)

/**
 * 订单消息列表
 * @param {string} orderId
 * @returns {Promise<Message[]>}
 */
listMessages(orderId)

/**
 * 发送文字消息
 * @param {string} orderId
 * @param {string} content
 * @returns {Promise<Message>}
 */
sendMessage(orderId, content)
```

### 依赖

- M1：`ensureLogin()`、`getProfile()`
- M3：`getOrderById()` 校验订单状态与参与者（P1：`pending_departure` | `in_progress` 可聊天）

---

## M2 — UI 组件

**路径**：`miniprogram/components/`、`miniprogram/styles/`

### 设计 token（M2 维护）

文件：`miniprogram/styles/tokens.wxss`

```css
/* 其他模块通过 class 或 @import 使用，勿硬编码色值 */
```

### 计划提供的共享组件

| 组件 | 路径 | 用途 |
|------|------|------|
| `dd-card` | `components/dd-card/` | 卡片容器 |
| `dd-button` | `components/dd-button/` | 主/次按钮 |
| `dd-tag` | `components/dd-tag/` | 状态/类型标签 |
| `dd-empty` | `components/dd-empty/` | 空状态 |
| `order-card` | `components/order-card/` | 订单列表项（M2 布局，M3 提供数据字段约定） |

### order-card 数据约定

组件 `properties.order` 接收 [`DATA_MODEL.md`](./DATA_MODEL.md) 中的 Order 对象，自行调用 M3 的 `formatRoute` 或在 properties 中传入 `routeLabel`。

---

## 页面路由

| 路径 | Owner | 说明 |
|------|-------|------|
| `/pages/index/index` | M2 | 广场 |
| `/pages/publish/publish` | M3 | 发布订单 |
| `/pages/detail/detail?orderId=` | M3 | 订单详情 |
| `/pages/mine/mine` | M1 | 我的 |
| `/pages/login/login` | M1 | 邮箱登录（Mock 预览） |
| `/pages/onboarding/identity/identity` | M1 | 首次选择身份 |
| `/pages/identity-manage/identity-manage` | M1 | 身份管理 |
| `/pages/account/account` | M1 | 账号与安全 |
| `/pages/vehicle/vehicle` | M1 | 车辆信息 |
| `/pages/preference/preference` | M1 | 乘车偏好 |
| `/pages/habit-tags/habit-tags` | M1 | 习惯标签 |
| `/pages/history/history` | M1 | 订单历史列表 |
| `/pages/history-detail/history-detail` | M1 | 订单历史详情 |
| `/pages/notify/notify` | M1 | 通知中心 |
| `/pages/chat/chat?orderId=` | M4 | 订单聊天 |

新增页面必须 PR 更新 `app.json` 和本文档。

---

## 集成检查点

| 检查点 | 参与模块 | 验证内容 |
|--------|----------|----------|
| CP1 | M2 + M3 | 广场展示 `matching` 订单，顺路排序 |
| CP2 | M1 + M3 | 发单 → 我的订单为 **匹配中** |
| CP2b | M1 + M3 | 接单 → **待出发** + 通知乘客 |
| CP3 | M3 | 待出发 → 行程中 → 已完成 |
| CP4 | M3 + M4 | （P1）聊天 |
| CP5 | 全部 | 完整路径见 MVP_SCOPE / PRD |
