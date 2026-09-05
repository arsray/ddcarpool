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
