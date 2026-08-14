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

### 导出接口（M3 实现）

```js
// miniprogram/modules/order/index.js

/**
 * 广场：待接取订单列表
 * @param {{ type?: 'seek'|'offer' }} filters
 * @returns {Promise<Order[]>}
 */
listOpenOrders(filters)

/**
 * 订单详情
 * @param {string} orderId
 * @returns {Promise<Order|null>}
 */
getOrderById(orderId)

/**
 * 创建订单
 * @param {CreateOrderInput} input
 * @returns {Promise<string>} 新订单 _id
 */
createOrder(input)

/**
 * 接取订单
 * @param {string} orderId
 * @param {{ openId: string, nickName: string }} accepter
 * @returns {Promise<void>}
 */
acceptOrder(orderId, accepter)

/**
 * 取消订单
 * @param {string} orderId
 * @returns {Promise<void>}
 */
cancelOrder(orderId)

/**
 * 标记完成
 * @param {string} orderId
 * @returns {Promise<void>}
 */
completeOrder(orderId)

/**
 * 固定点位列表
 * @returns {Promise<Point[]>}
 */
listPoints()

/**
 * 格式化路线文案
 * @param {string} fromPointId
 * @param {string} toPointId
 * @param {Point[]} [points]
 * @returns {string} 如「停车场 A 区 → 11 号线迪士尼站」
 */
formatRoute(fromPointId, toPointId, points)
```

### 类型（参考）

```js
/**
 * @typedef {Object} CreateOrderInput
 * @property {'seek'|'offer'} type
 * @property {string} fromPointId
 * @property {string} toPointId
 * @property {string} departTime - YYYY-MM-DD HH:mm
 * @property {number} [seats]
 * @property {string} [note]
 * @property {string} publisherOpenId
 * @property {string} publisherName
 */
```

### 依赖

- M1：`ensureLogin()` 获取身份

### 被依赖

- M2：主页列表
- M1：我的订单（或 M1 调 order 模块查询）
- M4：校验订单 status === 'matched'

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
- M3：`getOrderById()` 校验订单状态与参与者

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
| CP1 | M2 + M3 | 主页能展示 M3 mock 订单数据 |
| CP2 | M1 + M3 | 登录后能发布并在「我的」看到 |
| CP3 | M3 + M4 | 已匹配订单能进入聊天 |
| CP4 | 全部 | 完整用户路径验收（见 MVP_SCOPE.md） |
