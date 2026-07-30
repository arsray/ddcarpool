# styles/

M2 模块目录。维护全局设计 token 与基础样式。

- `tokens.wxss` — 颜色、字号、间距等 CSS 变量
- `base.wxss` — 页面级通用 class

其他模块通过 `app.wxss` 自动引入，或在组件内 `@import` token。
