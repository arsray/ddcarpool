# M4 — chat 模块

负责人：M4

## 职责

- 已匹配订单的文字聊天
- 对话模板库与快捷发送
- 消息权限校验

## 接口

见 `docs/MODULE_CONTRACTS.md` → M4 chat 模块

## 数据

- 集合 `messages`
- 模板数据：`templates.js`（本地常量，按乘客/司机分组）

## 实现状态

| 函数 / 能力 | 状态 |
|------|------|
| `canEnterChat` | ✅ |
| `listMessages` | ✅ |
| `sendMessage` | ✅ |
| `getMessageTemplates` | ✅ 乘客/司机分组 + 快捷栏 |
| 快捷模板栏 | ✅ `pages/chat/` |
| 完整模板库面板 | ✅ 「更多」展开 |
| `sendSticker` / 恶搞表情 | ✅ 6 张表情 + 面板 |
