# cloudfunctions/

| 云函数 | Owner | 说明 | 状态 |
|--------|-------|------|------|
| `login` | 维护者 | 返回真实 openid 和用户状态 | 已实现 |
| `user` | 维护者 | Profile、身份、车辆和偏好 | 已实现 |
| `emailAuth` | 维护者 / M1 SMTP | 验证码安全与发信适配 | 安全逻辑已实现，SMTP 待 M1 |
| `order` | 维护者 | 订单、事务化接单与过期触发器 | 已实现 |
| `notification` | 维护者 | 当前用户通知与已读 | 已实现 |
| `message` | 维护者 | 参与者文字聊天 | 已实现 |
| `seedConfig` | 维护者 | 幂等导入 POI / 配置路线 | 已实现 |

部署步骤、集合权限、索引和环境变量见 [`docs/CLOUD_DEPLOYMENT.md`](../docs/CLOUD_DEPLOYMENT.md)。

所有客户端参数均视为不可信。用户身份必须使用 `cloud.getWXContext().OPENID`，不能接受客户端 openId 作为授权依据。
