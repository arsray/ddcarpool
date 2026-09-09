# 微信开发者工具 UI 自动化（Automator）

## 前置条件

1. 已安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)  
2. 工具 → **设置 → 安全设置 → 服务端口：开启**  
3. 导入项目根目录 `/Users/wud086/Documents/ddcarpool` 并保持编译成功  
4. 安装依赖：`npm install miniprogram-automator --save-dev`

## 运行

```bash
npm run test:e2e
```

或：

```bash
node tests/e2e/run-automator.js
```

## 说明

- Automator 通过 WebSocket 连接本机开发者工具，**无法在无头环境远程跑**。  
- 首次运行若连接失败，确认工具已打开、端口已开启、项目路径正确。  
- 当前脚本覆盖 **登录 + Mock 账号切换** 骨架；完整 P0 UI 流程可按 `p0-flow.test.js` 场景逐步补充 `tap` / `switchTab`。

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `WECHAT_CLI_PATH` | 自动探测 | 开发者工具 `cli` 可执行文件路径 |
| `WECHAT_PROJECT_PATH` | 仓库根目录 | 小程序 project.config.json 所在目录 |
