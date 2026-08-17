# M3 order 模块

Owner: M3（订单 / 点位 / 顺路 / 状态机）

## 职责（P0）

- 乘客 `createOrder` → **matching**
- 司机 `acceptOrder` → **pending_departure**
- `startTrip` / `completeOrder` → **in_progress** / **completed**
- `cancelOrder` / `expireStaleOrders` → **closed**
- POI、configured_routes、顺路排序

## 文档

- `docs/DATA_MODEL.md` v2
- `docs/MODULE_CONTRACTS.md` M3 节

## 目录

```
order/
├── index.js           # 对外 API（仅 require 此文件）
├── service.js         # TODO: 云库读写
├── match.js
├── status-machine.js
├── constants.js       # 兼容 re-export
└── constants/
    ├── status.js
    ├── points.js
    └── routes.js
```

## 错误码

见 `docs/MODULE_CONTRACTS.md` M3 节。
