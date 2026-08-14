# ddcarpool · Cast 顺风车小程序

Profile 模块预览版（本地 Mock 数据，可微信开发者工具直接预览）。

## 预览步骤

1. 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. **导入项目** → 选择本目录：`~/Documents/ddcarpool`
3. AppID：`wx7e29645b7284e0cb`
4. 云环境（可选）：`cloudbase-d3g3o2bbha98776ab`
5. 点击 **编译** → 默认进入登录页

## 预览登录

- 邮箱：任意 `@disney.com`（大小写不敏感）
- 验证码：点击「获取验证码」后，页面底部会显示 **预览码**（正式版将发至邮箱）
- 首次登录会引导选择身份（车主/乘车人）并填写必要信息

## 本版本已实现（Profile P0 预览）

| 页面 | 路径 |
|---|---|
| 登录 / 注册 | pages/login |
| 首次身份选择 | pages/onboarding/identity |
| 身份管理 | pages/identity-manage |
| 我的（双身份） | pages/profile |
| 账号与安全 | pages/account |
| 车辆管理 | pages/vehicle |
| 乘车偏好 | pages/preference |
| 习惯标签 P1 | pages/habit-tags |
| 发车单/搭车单历史 | pages/history |
| 历史详情 | pages/history-detail |
| 通知中心 | pages/notify |

首页 / 发布 / 消息 为占位，待与其他同事模块合并。

## 产品需求文档

见：`~/Documents/10 Knowledge_base/AI产品/cast-carpool-requirements/`

## 上传 GitHub（无本机 Git 时）

1. 打开 https://github.com/arsray/ddcarpool
2. **Add file → Upload files**，上传整个 `ddcarpool` 文件夹
3. 建议分支名：`feature/profile-mvp`

## 项目结构

```
ddcarpool/
├── project.config.json
├── miniprogram/
│   ├── app.js / app.json / app.wxss
│   ├── utils/mock.js      ← 预览 Mock 数据
│   └── pages/
└── README.md
```
