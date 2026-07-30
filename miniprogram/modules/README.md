# modules/

各业务模块的业务逻辑入口。页面层通过 `require` 调用，禁止跨模块直接读写内部实现文件。

| 目录 | 模块 | Owner |
|------|------|-------|
| `auth/` | M1 登录 / Profile / 我的订单 | _待填写_ |
| `order/` | M3 订单生命周期 / 点位 | _待填写_ |
| `chat/` | M4 聊天 | _待填写_ |

接口定义见 `docs/MODULE_CONTRACTS.md`。
