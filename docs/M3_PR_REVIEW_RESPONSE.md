# PR Review 响应 — feat/m3-flow-optimization

> 针对 @arsray Request Changes 的修复说明。请将下文 **PR 描述补充** 粘贴到 GitHub PR 中，并勾选契约变更、@ 相关 Owner。

---

## 修复摘要

| 反馈项 | 处理 |
|--------|------|
| **Blocking** matching 阶段聊天 | 移除详情页 `matching` 司机「联系乘客」CTA；`canEnterChat` 与 main 契约对齐，仅 `pending_departure` \| `in_progress` 且为参与者可进聊天 |
| **Blocking** `orders.driverVehicle` 文档 | 已补充 `docs/DATA_MODEL.md` § `orders.driverVehicle` |
| **Blocking** 聊天契约文档 | 已更新 `docs/MODULE_CONTRACTS.md` `canEnterChat` 规则说明 |
| **小尾巴** Cloud 车辆回退 | `resolveDriverVehicle` 在 `useCloud` 下不再回退 Mock Bob 车辆；无快照时展示「车辆信息待补充」 |
| **小尾巴** Cloud Test plan | 见下方 Test plan |

未采用「接单前可聊」方案，故 **未** 修改 `message` 云函数，无需 M4 契约扩展。

---

## 代码变更文件

- `miniprogram/pages/detail/detail-view-model.js` — `matching` 司机 CTA 去掉 `chat`
- `miniprogram/modules/chat/index.js` — `canEnterChat` 移除 matching 分支
- `miniprogram/modules/order/driver-vehicle.js` — Cloud 模式禁用 Mock 车辆回退
- `docs/DATA_MODEL.md` — 新增 `driverVehicle` 字段与子表
- `docs/MODULE_CONTRACTS.md` — 明确聊天准入与 matching 不可聊

---

## PR 描述补充（复制到 GitHub）

```markdown
## Review 响应（@arsray）

- [x] **有契约变更**（`DATA_MODEL.md` · `orders.driverVehicle`；`MODULE_CONTRACTS.md` · `canEnterChat`）
- [x] **matching 聊天**：已移除接单前「联系乘客」CTA；`canEnterChat` 仅 `pending_departure` | `in_progress` + 参与者
- [x] **Cloud 车辆卡片**：`resolveDriverVehicle` 在 Cloud 下不回退 Mock Bob

### Owner Review

- @Crystal-la — M1（通知进详情、用户资料）
- @shanyilian — M2（广场/详情 UI）
- @StephanieFan1202 @lizzzzsun — M3（订单、筛选、详情 CTA）
- @Brianlin1990 — M4（聊天准入契约对齐，无 message 云函数变更）

## Test plan

### Mock（已测）
- [x] 乘客发布：POI 下拉选点
- [x] 车主广场：筛选 / 途经同向匹配 / 「其他待接订单」
- [x] 详情：各状态水印、CTA、车主卡片
- [x] `matching` 详情：司机仅「确认接单」「返回广场」，无聊天入口

### Cloud（请 Reviewer 或作者在云环境验证）
- [ ] 配置 `miniprogram/config/env.js`（`cloudEnvId` + `useCloud: true`），部署 `order` / `message` 云函数
- [ ] 乘客发单 → 车主广场筛选顺路单 → 接单
- [ ] 乘客详情：车主卡片展示 `driverVehicle` 快照（品牌/车牌/颜色）
- [ ] 通知点击进入统一详情页
- [ ] `pending_departure`：双方可见「联系」类聊天入口；`matching` 不可进聊天
```

---

## 给 Reviewer 的一句话

已按 main 聊天契约收口：matching 不可聊；`driverVehicle` 文档与 Cloud 展示逻辑已对齐服务端快照行为。

---

## Ray 联调指引

> **PR #6 代码在分支 `feat/m3-flow-optimization`，尚未 merge 到 `main`。**  
> 仅 `git pull origin main` **拿不到**本 PR 的任何改动。

### 团队开发约定（Ray · 2026-09）

项目已接入微信云开发。**新功能以 Cloud 为验收标准**：

1. 每人本地维护 `miniprogram/config/env.js`（不提交 Git），`useCloud: true` + 团队 `cloudEnvId`
2. 可用 Mock（`useCloud: false`）快速改 UI，但 **PR 合并前必须在 Cloud 验通主路径**
3. 修改 `cloudfunctions/**` 后，须在微信开发者工具 **上传并部署**，`git push` 不会更新云端

### 1. 拉取正确分支

```bash
git fetch origin
git checkout feat/m3-flow-optimization
git pull origin feat/m3-flow-optimization
```

### 2. 配置本地环境（`env.js` 不在 Git 中）

复制 `miniprogram/config/env.example.js` → `miniprogram/config/env.js`。

**团队默认（推荐，与 Ray 本地一致）：**

```js
module.exports = {
  cloudEnvId: 'cloudbase-xxxxxxxx',  // 向 Ray / M1 索取，勿提交仓库
  useCloud: true,
  environment: 'development',
  allowMockEmailVerification: true
}
```

**仅离线改 UI（不可作为 PR 唯一验收）：**

```js
module.exports = {
  cloudEnvId: '',
  useCloud: false,
  environment: 'development',
  allowMockEmailVerification: true
}
```

### 3. 微信开发者工具

1. 导入项目根目录 `ddcarpool`（含 `project.config.json`）
2. 确认 AppID 为占位符 `YOUR_APPID_HERE` 或使用团队测试号
3. 编译运行

### 4. 云函数部署（仅 Cloud 模式需要）

`git pull` **不会**自动更新云端云函数，必须在开发者工具中手动上传。

本 PR **仅修改** `cloudfunctions/order`（接单写入 `driverVehicle`、取消接单清除）。Cloud 联调时请：

1. 在云开发面板选中**团队共用环境**（与 `env.js` 的 `cloudEnvId` 一致）
2. 右键 `cloudfunctions/order` → **上传并部署：云端安装依赖**

其余云函数若团队基线已部署过，本 PR **无需**重复上传。

详细清单见 [`docs/CLOUD_DEPLOYMENT.md`](./CLOUD_DEPLOYMENT.md)。

### 5. 功能与依赖对照

| 功能 | 需要本 PR 分支 | Cloud 验收 | Mock 仅作 UI 草稿 |
|------|:--------------:|:----------:|:-----------------:|
| POI 搜索 / 广场筛选 | ✅ | ✅ 推荐 | 可临时 |
| 途经 / 同向路线匹配 | ✅ | ✅ 推荐 | 可临时 |
| 详情页 CTA / 状态水印 | ✅ | ✅ 推荐 | 可临时 |
| 接单后车主车辆卡片 | ✅ | ✅ **必须**（依赖 `order` 云函数） | 有 Mock 回退 |
| 通知 → 统一详情页 | ✅ | ✅ 推荐 | 可临时 |
| 聊天 | ✅ | ✅ **必须**（`message` 云函数） | 不可用 |

### 6. 常见问题

| 现象 | 可能原因 |
|------|----------|
| 拉 main 后界面没变化 | 应 checkout `feat/m3-flow-optimization` |
| Cloud 发单/接单失败 | `env.js` 未配置或 `cloudEnvId` 错误 |
| 接单后车主卡片无车辆信息 | 云端 `order` 云函数未部署本 PR 版本；或司机 Profile 未填车辆 |
| 大部分 UI 正常但 Cloud 接口报错 | 检查云函数是否部署到与 `env.js` 相同的环境 |

### 7. 建议验证路径

**Cloud（PR 合并前必做）：** 配置 `env.js`（`useCloud: true`）→ 部署本 PR 变更的 `order` 云函数 → 发单 → 筛选接单 → 乘客详情 `driverVehicle` → 通知进详情 → `pending_departure` 可聊、`matching` 不可聊。

**Mock（可选，仅 UI 草稿）：** 乘客发布 → 广场筛选 → 详情水印 / CTA；**不能替代 Cloud 验收。**

