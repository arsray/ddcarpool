# M1 Profile Mock 预览指南

> 微信开发者工具本地预览 M1（登录、Profile、我的订单）。**不含** M2 广场 / M3 发布真实业务。

## 预览步骤

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. **导入项目** → 选择仓库**根目录**（含 `project.config.json` 的文件夹）
3. 在 `project.config.json` 填入你的 AppID（勿提交他人 AppID 到公共分支）
4. 复制 `miniprogram/config/env.example.js` → `miniprogram/config/env.js`，填入云环境 ID（可选；Mock 阶段可不配）
5. 点击 **编译**

## 首屏说明

`app.json` 中 **`pages/login/login` 为第一项**：冷启动先进登录页（未登录用户路径）。

已登录用户会在登录页 `onShow` 中跳转 onboarding 或「我的」。  
**TabBar 首项仍为「广场」**（M2 脚手架），登录后可通过 Tab 切换；与 M2/M3 协作约定一致，Merge 后 M2 仍拥有广场首 Tab 体验。

## 预览登录

- 邮箱：输入 `@` **前面**部分，后缀固定 `@disney.com`
- 验证码：点击「获取验证码」后，页面底部显示 **预览码**（正式版将发至邮箱）
- 首次登录引导选择身份（车主/乘车人）并填写必要信息

## 本版本已实现（M1 P0 预览）

| 页面 | 路径 |
|------|------|
| 登录 / 注册 | `pages/login` |
| 首次身份选择 | `pages/onboarding/identity` |
| 身份管理 | `pages/identity-manage` |
| 我的（双身份） | `pages/mine` |
| 账号与安全 | `pages/account` |
| 车辆管理 | `pages/vehicle` |
| 乘车偏好 | `pages/preference` |
| 习惯标签 | `pages/habit-tags` |
| 我的订单 | `pages/history` |
| 订单详情 | `pages/history-detail` |
| 通知中心 | `pages/notify` |

**广场 / 发布 / 消息** 仍为 M2/M3 协作脚手架占位。

## UI 截图

见 [`docs/m1-screenshots/README.md`](./m1-screenshots/README.md)（PR Review 用）。

## 相关文档

- 订单集成（Agent / 开发）：[`ORDER_INTEGRATION_GUIDE.md`](./ORDER_INTEGRATION_GUIDE.md)
- 订单流转（产品经理）：[`ORDER_FLOWS_PM.md`](./ORDER_FLOWS_PM.md)
