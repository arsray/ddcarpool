# M1 订单状态机图

> 配套 [`M1_ORDER_STATES.md`](./M1_ORDER_STATES.md)、[`ORDER_INTEGRATION_GUIDE.md`](./ORDER_INTEGRATION_GUIDE.md)。底层 5 态；**展示名**因订单类型而异。

---

## 1. 统一底层状态机（所有订单类型）

```mermaid
stateDiagram-v2
    direction TB

    [*] --> open : 发布搭车单 / 发布发车单

    open --> matched_pre : 车主接受搭车单
    note right of open
        乘车人·搭车单：匹配中
        车主·发车单：匹配中
        车主·接受订单：不在此态（接单后直接进入 matched_pre）
    end note

    matched_pre --> matched_trip : 进入行程窗口 T-15
    note right of matched_pre
        展示：待出发
        副文案：昵称 · N人
    end note

    matched_trip --> completed : 到达 T+30 / 标记完成
    note right of matched_trip
        展示：行程中
    end note

    open --> closed : 取消 / 停止匹配 / 超时
    matched_pre --> closed : 取消搭车单 / 取消接单 / 取消发车单
    matched_trip --> closed : 取消（匹配后）

    completed --> [*]
    closed --> [*]

    note right of completed
        展示：已完成
        无二级状态
        Chat 可进至次日（M4）
    end note

    note right of closed
        展示：已关闭
        乘车人：再来一单
        车主·接受：无再来
        车主·发布：再发一单
    end note
```

---

## 2. 乘车人 · 搭车单（可多条并行）

```mermaid
stateDiagram-v2
    direction LR

    [*] --> 匹配中 : 发布搭车单

    匹配中 --> 待出发 : 车主接受
    匹配中 --> 已关闭 : 取消搭车单 / 超时未匹配

    待出发 --> 行程中 : T-15
    待出发 --> 已关闭 : 取消搭车单

    行程中 --> 已完成 : T+30
    行程中 --> 已关闭 : 取消搭车单

    已完成 --> [*]
    已关闭 --> [*]

    note right of 匹配中
        无二级状态
        按钮：编辑 | 取消搭车单
    end note

    note right of 待出发
        副文案：车主昵称 · N人
        按钮：Chat | 取消搭车单
    end note
```

---

## 3. 车主 · 接受订单（原「我接的搭车单」）

```mermaid
stateDiagram-v2
    direction LR

    [*] --> 待出发 : 在广场接受搭车单

    待出发 --> 行程中 : T-15
    待出发 --> 已关闭 : 取消接单 / 对方取消

    行程中 --> 已完成 : T+30
    行程中 --> 已关闭 : 取消

    已完成 --> [*]
    已关闭 --> [*]

    note right of 待出发
        副文案：乘车人昵称 · N人
        按钮：Chat | 取消接单
        无「再接一单」
    end note
```

---

## 4. 车主 · 发车单（发布行程 · 匹配推荐后续）

```mermaid
stateDiagram-v2
    direction LR

    [*] --> 匹配中 : 发布发车单

    匹配中 --> 待出发 : 接受某条搭车单
    匹配中 --> 已关闭 : 停止匹配 / 超时 / 取消

    待出发 --> 行程中 : T-15
    待出发 --> 已关闭 : 取消发车单

    行程中 --> 已完成 : T+30
    行程中 --> 已关闭 : 取消

    已完成 --> [*]
    已关闭 --> [*]

    note right of 匹配中
        按钮：查看匹配推荐(占位)
              编辑 | 停止匹配
        推荐逻辑未做
    end note

    note right of 待出发
        副文案：乘车人昵称 · N人
        与乘车人侧格式一致
    end note
```

---

## 5. 三类型在同一 Filter 下的归类

```mermaid
flowchart TB
    subgraph 未完成
        A1[搭车单 · 匹配中]
        A2[发车单 · 匹配中]
        B[待出发 · 三类均有]
        C[行程中 · 三类均有]
    end

    subgraph 已完成
        D[已完成 · 无二级]
    end

    subgraph 已关闭
        E[已关闭 · 见二级定义]
    end

    A1 --> B
    A2 --> B
    B --> C
    C --> D
    A1 --> E
    A2 --> E
    B --> E
    C --> E
```

---

## 6. 匹配完成路径（业务流）

```mermaid
sequenceDiagram
    participant P as 乘车人
    participant S as 广场
    participant O as 车主

    Note over P: 主路径
    P->>S: 发布搭车单（匹配中，可多条）
    O->>S: 浏览搭车单
    O->>P: 接受搭车单
    Note over P,O: 双方 → 待出发 → 行程中 → 已完成

    Note over O: 次级路径
    O->>S: 发布发车单（匹配中）
    Note over O: 查看匹配推荐（占位，后续）
    O->>P: 仍通过「接受搭车单」完成匹配
    Note over P,O: 发车单 → 待出发 → …
```
