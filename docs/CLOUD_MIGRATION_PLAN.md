# 云开发统一接入计划

本文档定义 ddcarpool 从本地 Mock / Storage 迁移到微信云开发的实施范围、责任边界、技术方案、上线步骤和验收标准。

## 1. 决策与责任边界

### 统一原则

- 云开发环境、数据库、云函数、客户端接入、Mock 迁移和部署均由维护者 Ray 统一实施。
- 云接入工作在独立分支完成，通过一个或多个可审查 PR 合入 `main`。
- 云接入 PR 合并前，现有 `main` 仍是各模块的本地 Mock 基线。
- 云接入 PR 合并后，所有成员必须从新的 `main` 更新或重建功能分支，再继续开发。
- 模块成员在云接入期间不要自行修改云数据库结构、云函数接口或环境配置；需求通过 Issue / PR 评论反馈。

### 唯一例外：M1 SMTP

M1 仅负责“发送邮箱验证码”的 SMTP 实现，其他入云工作仍由维护者负责。

M1 的交付边界：

- 实现约定的邮件发送函数，接收收件邮箱、验证码和有效期。
- 提供成功、失败的稳定返回值和错误码。
- 不负责验证码生成、校验、登录态、用户入库、云函数路由或客户端接入。
- SMTP 主机、端口、用户名、密码 / 授权码必须通过云函数环境变量或密钥管理配置，不得提交到 Git、写入客户端或输出到日志。
- 不在日志中记录完整邮箱、验证码或 SMTP 凭据。

维护者负责将 M1 的 SMTP 模块集成进邮箱验证码云函数，并完成部署、配置和端到端测试。

## 2. 当前基线

当前项目仅初始化了 `wx.cloud`，尚未实际调用云函数或云数据库：

- 登录 / Profile：邮箱 Mock + 本地 Storage。
- 订单：`m3_orders_v1` 本地 Storage。
- 通知：`notifications` 本地 Storage。
- POI / 路线：代码常量。
- 聊天：尚未接云。
- `cloudfunctions/login`：仅有返回微信 `openid` 的最小实现，客户端尚未调用。

本地 Mock 仅适合单设备演示，不能支持两个真实用户跨设备发单、接单和聊天。

## 3. 目标架构

### 身份

- 微信 `openid` 是服务端可信用户标识。
- 邮箱验证码仅用于验证公司邮箱归属，不用于替代微信身份。
- 客户端不得提交或覆盖业务操作中的 `openId`；云函数必须通过 `cloud.getWXContext().OPENID` 获取当前操作者。
- `users` 保存微信身份、已验证邮箱、Profile、角色、车辆和偏好。

### 数据访问

- 配置类数据可由客户端只读：`points`、`configured_routes`。
- 用户资料、订单状态变更、通知和消息通过云函数访问。
- `acceptOrder` 必须在服务端使用事务或原子条件更新，避免同一订单被两名司机同时接取。
- 云函数必须重新校验所有客户端输入、操作者身份、订单状态和参与者权限。
- 用户可见错误使用稳定错误码；内部错误细节仅写服务端日志，且不得包含凭据、验证码或个人敏感信息。

### 云资源

建议使用以下集合：

| 集合 | 用途 | 客户端权限建议 |
|------|------|----------------|
| `users` | Profile、邮箱验证状态、身份、车辆和偏好 | 仅管理端读写 |
| `orders` | 订单及五态状态机 | 仅管理端读写 |
| `points` | POI 配置 | 所有用户可读，客户端不可写 |
| `configured_routes` | 顺路路线配置 | 所有用户可读，客户端不可写 |
| `notifications` | 接单、取消等站内通知 | 仅管理端读写 |
| `messages` | 订单聊天消息 | 仅管理端读写 |
| `email_verifications` | 邮箱验证码、过期时间、尝试次数 | 仅管理端读写 |

`notifications` 和 `email_verifications` 需补充到 `DATA_MODEL.md` 后再作为正式契约使用。

建议使用以下云函数：

| 云函数 | 主要职责 |
|--------|----------|
| `login` | 获取真实 openid，读取当前用户和邮箱验证状态 |
| `emailAuth` | 申请邮箱验证码、校验验证码、限流；调用 M1 SMTP 模块发信 |
| `user` | 获取 / 更新 Profile、身份、车辆和偏好 |
| `order` | 创建、列表、详情、接单、取消、开始、完成、过期处理 |
| `notification` | 当前用户通知列表、标记已读 |
| `message` | 聊天准入、消息列表、发送消息 |

云函数名称可在实现 PR 中调整，但客户端只能通过模块公共接口调用，不直接依赖函数内部结构。

## 4. 数据契约

### 订单

订单字段和状态以 `docs/DATA_MODEL.md` 为准：

`matching → pending_departure → in_progress → completed / closed`

云端写入时间统一使用数据库服务端时间。当前字符串 `departTime` 在迁移时应明确业务时区；推荐新增可查询的 Date 字段或统一存储格式，避免客户端时区导致过期判断错误。

### 邮箱验证码

`email_verifications` 至少包含：

- 标准化邮箱或不可逆邮箱标识。
- 验证码安全摘要，不存明文验证码。
- 创建、过期和最近发送时间。
- 验证失败次数及锁定状态。
- 请求者 openid。
- 使用状态。

安全要求：

- 使用密码学安全随机数生成验证码。
- 验证码短时有效、单次使用。
- 对 openid、邮箱和来源进行发送频率限制。
- 限制校验次数，超限后锁定或作废。
- 返回响应不得泄露邮箱是否已注册、验证码值或 SMTP 细节。
- 邮箱和验证码属于敏感数据，不写入客户端 Storage 或 URL。

### 本地 Mock 数据

- 不迁移 `m3_orders_v1`、Mock 用户快照、Mock 通知和本地验证码。
- 仅迁移正式配置种子：`points`、`configured_routes`。
- 开发种子订单必须通过显式开发开关或一次性脚本导入，不得在正式启动路径自动写入。

## 5. 实施阶段

### Phase A：云环境准备

- [ ] 创建或确认团队共用的开发云环境。
- [ ] 环境 ID 仅放在每位开发者的 `miniprogram/config/env.js`，不提交 Git。
- [ ] 创建集合并配置最小权限。
- [ ] 创建索引：
  - `users.openId` 唯一索引。
  - `users.emailNormalized` 唯一索引（如业务要求一邮箱绑定一用户）。
  - `orders(status, departTime)`。
  - `orders(passengerOpenId, createdAt)`。
  - `orders(driverOpenId, createdAt)`。
  - `notifications(recipientOpenId, createdAt)`。
  - `messages(orderId, createdAt)`。
- [ ] 导入 `points` 和 `configured_routes` 种子数据。
- [ ] 配置云函数环境变量和最小权限。
- [ ] 建立开发环境数据清理 / 重置方式。

### Phase B：基础身份与用户上云

- [ ] 客户端调用 `login`，以真实 openid 初始化会话。
- [ ] 实现 `users` 的读取与 upsert。
- [ ] 实现邮箱验证码申请和校验流程。
- [ ] 集成 M1 SMTP 模块。
- [ ] Profile、身份、车辆和偏好切换为云端数据。
- [ ] 保留明确的开发模式入口，但正式 / 体验构建不得展示 Mock 账号切换。

### Phase C：订单上云

- [ ] 保持 `modules/order/index.js` 公共 API 尽量不变。
- [ ] 将 `service.js` 的 Storage 读写替换为云函数调用或云端适配器。
- [ ] 实现云端 `createOrder`、`listOpenOrders`、`getOrderById`。
- [ ] 实现事务化 `acceptOrder`。
- [ ] 实现有权限校验的 `cancelOrder`、`startTrip`、`completeOrder`。
- [ ] 服务端处理订单过期；不得依赖某个客户端打开页面才触发。
- [ ] 接单 / 取消等操作原子写入对应通知。
- [ ] 移除默认执行的 seed/reset 本地逻辑。

### Phase D：通知与聊天上云

- [ ] 通知列表按云端当前 openid 查询。
- [ ] 标记已读仅允许通知接收者操作。
- [ ] 聊天仅允许订单乘客和司机进入。
- [ ] 仅 `pending_departure` / `in_progress` 状态允许发送消息（最终规则以最新契约为准）。
- [ ] 消息正文做长度、类型和空白校验。
- [ ] 列表使用分页 / 游标，避免一次读取全部消息。

### Phase E：切换与清理

- [ ] 增加统一环境配置，开发阶段允许显式选择 Mock 或 Cloud。
- [ ] 云端端到端测试通过后，将团队默认切换为 Cloud。
- [ ] 删除或隔离 Mock 用户、静态排行、种子订单和自动 reset 逻辑。
- [ ] 更新 `README.md`、`COLLABORATION.md`、`DATA_MODEL.md`、`MODULE_CONTRACTS.md`。
- [ ] PR 合入 `main` 后通知全员停止基于旧 Mock main 开发。

## 6. 代码改动范围

预计由维护者统一修改：

- `miniprogram/app.js`
- `miniprogram/config/env.example.js`
- `miniprogram/modules/auth/**`
- `miniprogram/modules/order/**`
- `miniprogram/modules/chat/**`
- `miniprogram/pages/**` 中必要的数据加载、登录态和错误状态
- `cloudfunctions/**`
- `docs/DATA_MODEL.md`
- `docs/MODULE_CONTRACTS.md`
- `docs/COLLABORATION.md`
- `README.md`

为降低页面改动，优先采用适配器方式：

```text
页面
  ↓
modules/*/index.js（公共接口保持稳定）
  ↓
cloud adapter / wx.cloud.callFunction
  ↓
云函数
  ↓
云数据库
```

禁止页面直接散落调用 `wx.cloud.database()`；跨模块页面只调用对应模块的公共接口。

## 7. 分支与团队切换流程

### 云接入期间

1. 维护者从最新 `main` 创建云接入分支，例如 `feat/shared-cloud-integration`。
2. 其他成员可完成当前已开始的 PR，但不要再从旧 `main` 开启新的长期功能分支。
3. 云接入涉及契约变更时，在 PR 中 @ 所有模块 Owner Review。
4. M1 单独提交 SMTP 模块时，应向维护者的云接入分支提 PR，或提供可 cherry-pick 的独立 commit；不要直接向 `main` 合入未集成代码。
5. 云接入 PR 合并前完成双设备联调和回归测试。

### 云接入合并后

每位成员先同步新基线：

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
```

尚未开始的新功能：

```bash
git checkout -b feat/<module>-<feature> origin/main
```

仍有未合并旧分支：

- 不执行 `--allow-unrelated-histories`。
- 先备份并提交现有工作。
- 从最新 `origin/main` 新建干净分支。
- 仅 cherry-pick 自己模块的功能 commit。
- 解决冲突并完成云端回归后再开 PR。

## 8. 验收标准

### 功能验收

- [ ] 两个不同微信账号、两台设备共享同一云环境。
- [ ] 用户 A 完成登录和邮箱验证，Profile 可跨设备恢复。
- [ ] 乘客 A 发布订单，司机 B 能在广场看到。
- [ ] B 接单后订单只成功匹配一次，A 收到通知。
- [ ] 非参与者不能读取私有订单详情或修改状态。
- [ ] A / B 可按规则取消、开始和完成订单。
- [ ] 我的订单、通知和聊天在重新登录后仍存在。
- [ ] POI 和配置路线来自云端，异常时有明确降级策略。

### 安全验收

- [ ] 仓库中无环境 ID 以外的敏感配置；无 SMTP 密码、Token、验证码。
- [ ] SMTP 凭据仅存在于云函数安全配置中。
- [ ] 所有订单写操作由云函数根据真实 openid 授权。
- [ ] `acceptOrder` 已通过并发双接测试。
- [ ] 邮箱验证码具备过期、限流、失败次数限制和单次使用机制。
- [ ] API 响应和客户端提示不暴露堆栈、内部路径或凭据。
- [ ] 日志不记录验证码、完整邮箱、openid 或其他不必要的个人信息。
- [ ] 数据库集合遵循最小权限。

### 回归验收

- [ ] 登录 / onboarding / Profile。
- [ ] 车主 / 乘客 / 消息 / 我的四个 Tab。
- [ ] 广场筛选、发单、接单、取消、完成。
- [ ] 通知按用户隔离并可标记已读。
- [ ] M4 聊天主路径。
- [ ] 微信开发者工具编译及至少两台真机测试通过。

## 9. 回滚策略

- 云接入合并前保留最后一个 Mock 基线 commit / tag。
- 云接入通过配置开关灰度启用，禁止依赖手工改源码切换。
- 数据结构变更优先向后兼容；破坏性迁移必须先备份。
- 若云端主路径阻塞，可临时关闭 Cloud 开关回到 Mock，仅用于内部开发，不用于外部试用。
- 回滚不得放宽数据库权限或跳过云函数授权。

## 10. 完成定义

满足以下条件后，云接入工作才可合入 `main`：

1. 云资源、索引和权限已配置并记录。
2. M1 SMTP 模块已集成，但凭据未进入仓库。
3. 身份、用户、订单、通知及当前 MVP 所需聊天数据均已上云。
4. 两账号、两设备端到端验收通过。
5. 所有契约和协作文档已更新。
6. Mock 默认路径已关闭，正式 / 体验构建无 Mock 账号入口。
7. 全体模块 Owner 已完成契约 Review，由维护者最终批准合并。
