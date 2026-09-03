# DD 蹭车 · 内部捎带匹配小程序

多人协作开发的微信小程序。项目支持本地 Mock 与微信云开发两种运行模式，团队联调以真实微信 openid 和云数据库为准。

## 开始前必读

| 文档 | 说明 |
|------|------|
| [docs/COLLABORATION.md](docs/COLLABORATION.md) | 分工、Git 流程、目录约定 |
| [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md) | MVP 范围与验收标准 |
| [docs/ORDER_INTEGRATION_GUIDE.md](docs/ORDER_INTEGRATION_GUIDE.md) | 订单状态机 · 跨模块集成（M2/M3/M4） |
| [docs/ORDER_FLOWS_PM.md](docs/ORDER_FLOWS_PM.md) | 订单流转图（产品经理版） |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | 云数据库集合（**Mock 阶段未与五态对齐**，见该文档顶部说明） |
| [docs/MODULE_CONTRACTS.md](docs/MODULE_CONTRACTS.md) | 跨模块接口契约 |
| [docs/CLOUD_DEPLOYMENT.md](docs/CLOUD_DEPLOYMENT.md) | 云环境、集合、索引、云函数和种子部署 |

## 快速开始

1. 克隆仓库，用[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/stable.html)导入**项目根目录**
2. 在 `project.config.json` 填入 AppID
3. 复制 `miniprogram/config/env.example.js` → `miniprogram/config/env.js`，填入云环境 ID（`env.js` 不提交）
4. 按 [云部署清单](docs/CLOUD_DEPLOYMENT.md) 创建集合、索引并部署云函数
5. 编译运行；SMTP 未交付前仅开发环境可使用预览验证码

## 项目结构

```
ddcarpool/
├── docs/                       # 协作文档
├── .github/                    # CODEOWNERS、PR 模板
├── miniprogram/
│   ├── modules/
│   │   ├── auth/               # M1
│   │   ├── order/              # M3
│   │   └── chat/               # M4
│   ├── pages/                  # 页面（按模块归属）
│   ├── components/             # M2 共享组件
│   ├── styles/                 # M2 设计 token
│   └── config/                 # 本地环境配置（env.js 不提交）
├── cloudfunctions/
│   ├── login/                  # 微信身份
│   ├── user/                   # Profile
│   ├── order/                  # 订单
│   ├── notification/           # 通知
│   ├── message/                # 聊天
│   └── emailAuth/              # 邮箱验证
└── project.config.json
```

## 模块分工

| 模块 | 目录 |
|------|------|
| M1 登录/Profile/我的订单 | `modules/auth/`、`pages/mine/`、`cloudfunctions/login/` |
| M2 主页/UI | `styles/`、`components/`、`pages/index/` |
| M3 订单/点位 | `modules/order/`、`pages/publish/`、`pages/detail/` |
| M4 聊天 | `modules/chat/`、`pages/chat/` |

详见 [COLLABORATION.md](docs/COLLABORATION.md)。

## 仓库

https://github.com/arsray/ddcarpool
