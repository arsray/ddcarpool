# 协作指南

本文档定义 ddcarpool 多人协作的分工、流程与规范。所有贡献者在写代码前请先阅读本文档及 `[DATA_MODEL.md](./DATA_MODEL.md)`。

## 团队与模块


| 模块               | 负责人               | GitHub | 拥有目录                                                                                              |
| ---------------- | ----------------- | ------ | ------------------------------------------------------------------------------------------------- |
| M1 登录/Profile/订单 | *Crystal*         | `@___` | `miniprogram/modules/auth/`、`miniprogram/pages/mine/`、`cloudfunctions/login/`                     |
| M2 主页/UI 风格      | *Shanny*          | `@___` | `miniprogram/styles/`、`miniprogram/components/`、`miniprogram/pages/index/`、`miniprogram/app.wxss` |
| M3 订单生命周期/点位     | *Stephanie**Liz* | `@___` | `miniprogram/modules/order/`、`miniprogram/pages/publish/`、`miniprogram/pages/detail/`             |
| M4 聊天            | *Brian*           | `@___` | `miniprogram/modules/chat/`、`miniprogram/pages/chat/`                                             |


> 请在团队确定后更新上表，并同步修改 `[.github/CODEOWNERS](../.github/CODEOWNERS)`。



## 里程碑



### Phase 0 — 协作脚手架（当前）

- [x] 仓库结构、文档、占位页面
- [ ] 四人确认 `[MVP_SCOPE.md](./MVP_SCOPE.md)` 与 `[DATA_MODEL.md](./DATA_MODEL.md)`
- [ ] 填写 CODEOWNERS 中的 GitHub 用户名
- [x] 小程序 AppID（`project.config.json`）
- [ ] 云开发环境 ID（各开发者本地 `miniprogram/config/env.js`）



### Phase 1 — 并行开发（目标：可演示 MVP）

各模块按 `[MODULE_CONTRACTS.md](./MODULE_CONTRACTS.md)` 实现，各自单元测试+集成测试，测试完成提交PR，Ray管理PR。


| 顺序  | 模块  | 交付物                 |
| --- | --- | ------------------- |
| 1   | M2  | 设计 token、基础组件、主页布局  |
| 2   | M3  | 订单 CRUD、状态机、点位配置    |
| 2   | M1  | 登录、Profile、「我的订单」列表 |
| 3   | M4  | 匹配后订单内文字聊天          |




### Phase 2 — 集成验收

完整路径：**登录 → 浏览 → 发布 → 接取 → 聊天 → 完成 → 我的订单**

## Git 工作流



### 分支

- `main`：受保护，仅通过 PR 合并
- 功能分支：`feat/m1-profile`、`feat/m2-design-tokens`、`feat/m3-order-lifecycle`、`feat/m4-chat`



### PR 规则

1. **一个 PR 一件事**，尽量只修改自己模块的目录
2. **先拉最新** `main`，再开分支
3. **改契约先 PR**：修改 `docs/DATA_MODEL.md` 或 `docs/MODULE_CONTRACTS.md` 需 @ 所有模块负责人 Review
4. **禁止**在未讨论的情况下修改他人模块目录
5. PR 描述使用 [模板](../.github/pull_request_template.md)



### Commit 规范

```
<type>(<scope>): <subject>

type: feat | fix | docs | refactor | chore
scope: m1-auth | m2-ui | m3-order | m4-chat | shared
```

示例：

```
feat(m3-order): add accept order state transition
docs(shared): update messages collection schema
```



## 目录约定

```
miniprogram/
├── modules/          # 各模块业务逻辑（模块 Owner 维护）
│   ├── auth/         # M1
│   ├── order/        # M3
│   └── chat/         # M4
├── pages/            # 页面（按上表归属，可引用 modules/）
├── components/       # 共享 UI 组件（M2 维护）
├── styles/           # 设计 token 与全局样式（M2 维护）
└── utils/            # 仅跨模块通用工具，新增需 PR 说明
```



## 冲突预防


| 文件/区域                  | 规则                                    |
| ---------------------- | ------------------------------------- |
| `docs/DATA_MODEL.md`   | 变更需全员 Review                          |
| `miniprogram/app.json` | 新增页面需 PR 说明；Tab 结构变更需 M2 Review       |
| `miniprogram/app.js`   | 仅改 globalData 结构时需更新 MODULE_CONTRACTS |
| `miniprogram/utils/`   | 禁止模块专用逻辑放入，应放 `modules/`              |
| `project.config.json`  | 仅维护者修改 appid 等配置                      |




## 本地开发

1. 克隆仓库，用微信开发者工具导入项目根目录
2. 复制 `miniprogram/config/env.example.js` 为 `env.js`（已 gitignore），填入云环境 ID
3. 按 [云开发部署清单](./CLOUD_DEPLOYMENT.md) 部署集合、索引、云函数和配置种子
4. 编译运行，验证登录、发单、接单、通知和聊天

## 云基线切换

- 云接入代码由维护者在 `feat/shared-cloud-integration` 统一集成；M1 仅交付约定的 SMTP 发送适配。
- 云接入合并前，不要从旧 `main` 新增长期功能分支。
- 合并后执行 `git fetch origin`、`git checkout main`、`git pull --ff-only origin main`，再从 `origin/main` 创建新分支。
- 旧 Mock 分支尚有未合并工作时，从新 `origin/main` 创建干净分支，只 cherry-pick 自己的业务提交。
- 禁止使用 `--allow-unrelated-histories`；禁止提交 `env.js`、SMTP 凭据、验证码或环境密钥。
- `users`、`orders`、`notifications`、`messages` 和 `email_verifications` 不允许客户端直接读写。



## 沟通

- **接口问题**：先查 `docs/MODULE_CONTRACTS.md`，不确定则开 Issue 讨论后再改契约
- **阻塞问题**：在 Issue 中 @ 对应模块 Owner
- **集成问题**：每周五集成窗口一起过完整用户路径



## 相关文档

- [MVP 范围](./MVP_SCOPE.md)
- [数据模型](./DATA_MODEL.md)
- [模块接口契约](./MODULE_CONTRACTS.md)
- [云开发部署清单](./CLOUD_DEPLOYMENT.md)

