# 微信云开发部署清单

## 1. 本地配置

复制 `miniprogram/config/env.example.js` 为 `miniprogram/config/env.js`，填写团队开发环境 ID。该文件已被 `.gitignore` 忽略。

开发环境可使用：

```js
module.exports = {
  cloudEnvId: '本地填写，不提交',
  useCloud: true,
  environment: 'development',
  allowMockEmailVerification: true
}
```

体验版和正式版必须将 `environment` 设为 `trial` 或 `production`。这两个环境会强制关闭 Mock 邮箱验证。

## 2. 集合与权限

在云开发控制台创建以下集合：

- `users`、`orders`、`notifications`、`messages`、`email_verifications`：仅云函数可读写。
- `points`、`configured_routes`：所有用户可读，仅云函数可写。

不要为了联调临时开放敏感集合的客户端读写权限。

## 3. 索引

创建以下索引：

- `users(openId)`：唯一。
- `users(email, emailVerified, openId)`：普通复合索引，用于防止正式邮箱重复绑定。
- `orders(status, departTimeAt)`。
- `orders(status, departTimeEndAt)`。
- `orders(passengerOpenId, createdAt)`。
- `orders(driverOpenId, createdAt)`。
- `orders(driverOpenId, status, departTimeAt)`。
- `orders(passengerOpenId, status)`。
- `points(enabled, sortOrder)`。
- `notifications(recipientOpenId, createdAt)`。
- `messages(orderId, createdAt)`。
- `email_verifications(openId, emailNormalized, used, createdAtMs)`。
- `email_verifications(openId, createdAtMs)`。
- `email_verifications(emailNormalized, createdAtMs)`。

## 4. 云函数

在微信开发者工具中逐个右键以下目录，选择“上传并部署：云端安装依赖”：

1. `cloudfunctions/login`
2. `cloudfunctions/user`
3. `cloudfunctions/emailAuth`
4. `cloudfunctions/order`
5. `cloudfunctions/notification`
6. `cloudfunctions/message`
7. `cloudfunctions/seedConfig`

`order/config.json` 包含每 5 分钟执行一次的过期订单任务。部署后在控制台确认触发器已创建。

部署后在云函数配置中调整执行超时：

- `login`、`user`、`notification`、`message`：10 秒。
- `order`：15 秒。
- `emailAuth`：20 秒（预留 SMTP 网络耗时）。
- `seedConfig`：30 秒。

## 5. 环境变量

- `seedConfig.ADMIN_OPENIDS`：允许执行配置种子的维护者 openid，多个值用英文逗号分隔。
- `emailAuth.EMAIL_CODE_PEPPER`：至少 32 字节的随机密钥。
- M1 SMTP 交付后所需的主机、端口、用户名和授权码：仅配置在 `emailAuth` 云函数环境变量中。

不要把环境变量值、完整邮箱、验证码或 openid 写入仓库和日志。

## 6. 配置种子

部署 `seedConfig` 并配置 `ADMIN_OPENIDS` 后，由维护者在开发者工具云函数测试入口调用一次：

```json
{}
```

该函数按 `pointId` / `routeId` upsert，可重复执行，不会导入 Mock 用户、订单或通知。执行后检查返回的数量，并在数据库确认 `points` 与 `configured_routes` 已启用。

## 7. 发布前验证

- 使用两个真实微信账号分别开通乘客与车主身份。
- 验证发单、双端可见、并发接单只有一次成功。
- 验证非参与者不能读取已匹配订单或聊天。
- 验证取消、开始、完成、通知已读和聊天分页。
- 将 `environment` 切到 `trial`，确认登录页不显示预览验证码。
- SMTP 未交付前，不得发布体验版或正式版给外部人员。
