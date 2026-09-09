# M1 邮箱验证码与登录态（Crystal）

【读者】M1 负责人、运维  
【M3/M4】不在本文范围  

---

## 一、登录态：30 天

| 项 | 值 |
|----|-----|
| 登录有效期 | **30 天** |
| 验证码有效期 | **10 分钟** |
| 实现 | `modules/auth/session.js` |

---

## 二、发信方式怎么选

| 方式 | 适合 | 说明 |
|------|------|------|
| **SMTP（推荐正式上线）** | 公司 `@disney.com` 邮箱 | 走企业邮件服务器，收件最稳 |
| **Resend API** | 个人联调 / 无 IT SMTP 时 | 免费 3000 封/月，需域名验证 |
| **Mock** | 本地预览 | `useCloudVerify: false`，页面显示预览码 |

### 没有公司 IT 时用什么？（个人资源 · 含大陆可注册）

| 方案 | 成本 | 大陆注册/访问 | 能发到 @disney.com？ | 建议 |
|------|------|---------------|---------------------|------|
| **继续 Mock 预览码** | 免费 | ✅ | — | **开发联调首选**，零配置 |
| **QQ 邮箱 SMTP** | 免费 | ✅ 易 | 可能进垃圾箱 | 大陆最方便的真邮件测试 |
| **163 邮箱 SMTP** | 免费 | ✅ 易 | 可能进垃圾箱 | 与 QQ 类似 |
| **Outlook 个人版** | 免费 | ⚠️ 视网络 | 相对较好 | Gmail 替代，网页有时可开 |
| **Brevo SMTP** | 免费 300 封/天 | ⚠️ 官网需能访问 | 验证发件邮箱后可用 | 比 QQ 发件更「像产品」 |
| **阿里云邮件推送** | 有免费额度 | ✅ | 需备案域名 | 有域名时可选 |
| **Resend + 自有域名** | 域名约 \$10/年 | ⚠️ | 验证域名后较稳 | 小规模准生产 |
| **Gmail** | 免费 | ❌ 大陆常打不开 | — | 不推荐在大陆环境注册 |

**实用建议（无 IT、在大陆）：**

1. **现在：** `useCloudVerify: false`，页面预览验证码  
2. **要测真邮件：** **QQ 邮箱** 或 **163** 开 SMTP + 授权码（见 § QQ / 163）  
3. **要给同事长期用：** **Outlook** 或 **Brevo**，或 cheap 域名 + 阿里云邮件推送  

> 个人邮箱发到 `@disney.com` 可能进垃圾箱，先给自己和同事各测一封。

---

## 三、SMTP 接入（推荐）

### 你需要先向 IT 申请的信息

请 IT / 邮箱管理员提供 **SMTP 中继** 或 **专用发信账号**：

| 信息项 | 示例（Microsoft 365） | 说明 |
|--------|----------------------|------|
| SMTP 服务器 | `smtp.office365.com` | 主机地址 |
| 端口 | `587` | 常用；SSL 用 `465` |
| 加密 | STARTTLS（587）或 SSL（465） | 与端口对应 |
| 账号 | `dd-carpool@disney.com` 或共用邮箱 | 发件专用 |
| 密码 | 应用密码 / 服务账号密码 | **勿提交 Git** |
| 发件人显示 | `DD Carpool <dd-carpool@disney.com>` | 写入 `MAIL_FROM` |

> 若公司用 Exchange On-Premise，主机可能是 `smtp.disney.com` 等，**以 IT 文档为准**。

### 步骤 1：云数据库

创建集合 **`verify_codes`**，权限：**仅云函数可读写**。

### 步骤 2：部署云函数

```text
cloudfunctions/authEmail/
```

微信开发者工具 → 右键 **上传并部署：云端安装依赖**（会安装 `nodemailer`）。

### 步骤 3：云函数环境变量（SMTP）

在微信云开发控制台 → 云函数 → `authEmail` → **环境变量**：

| 变量 | 必填 | 示例 |
|------|:----:|------|
| `MAIL_PROVIDER` | 建议 | `smtp` |
| `SMTP_HOST` | ✅ | `smtp.office365.com` |
| `SMTP_PORT` | ✅ | `587` |
| `SMTP_SECURE` | | `false`（587 填 false；465 填 true） |
| `SMTP_USER` | ✅ | 发信邮箱账号 |
| `SMTP_PASS` | ✅ | 应用密码 |
| `MAIL_FROM` | ✅ | `DD Carpool <dd-carpool@disney.com>` |
| `USE_MOCK_EMAIL` | 联调 | `true` 时不真发，返回 mockCode |

**不要**把这些变量写进小程序 `env.js` 或 Git。

### 步骤 4：小程序打开云验证

`miniprogram/config/env.js`（本地，已 gitignore）：

```js
module.exports = {
  cloudEnvId: '你的云环境 ID',
  useCloudVerify: true
}
```

### 步骤 5：验证顺序

1. `USE_MOCK_EMAIL=true` + `useCloudVerify: true` → 云函数通、页面可显示 mockCode  
2. 配齐 SMTP 后去掉 `USE_MOCK_EMAIL` → 真发到 `@disney.com` 收件箱  
3. 登录成功后 **30 天内** 再打开小程序无需重新验证码  

### 常见 SMTP 配置参考

**Microsoft 365 / Outlook**

```text
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=你的发信邮箱@disney.com
SMTP_PASS=应用密码（非登录密码，IT 开通）
MAIL_FROM=DD Carpool <你的发信邮箱@disney.com>
MAIL_PROVIDER=smtp
```

**SSL 465 端口**

```text
SMTP_PORT=465
SMTP_SECURE=true
```

---

## 三点五、QQ 邮箱 SMTP（大陆推荐）

### 1. 开启 SMTP 授权码

1. 登录 https://mail.qq.com → **设置** → **账户**  
2. 开启 **POP3/SMTP** 或 **IMAP/SMTP**  
3. 按提示发短信，获得 **16 位授权码**（不是 QQ 登录密码）

### 2. 云函数环境变量

```text
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的QQ号@qq.com
SMTP_PASS=16位授权码
MAIL_FROM=DD Carpool <你的QQ号@qq.com>
```

---

## 三点六、163 邮箱 SMTP

1. 登录 https://mail.163.com → 设置 → POP3/SMTP/IMAP → 开启 SMTP → 获取 **授权码**

```text
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.163.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的用户名@163.com
SMTP_PASS=授权码
MAIL_FROM=DD Carpool <你的用户名@163.com>
```

---

## 三点六点五、新浪邮箱 SMTP（ddcarpool@sina.com）

1. 登录 https://mail.sina.com → **设置** → **客户端 POP3/SMTP** → 开启 SMTP → 获取 **授权码**（非登录密码）
2. 发件邮箱用于 SMTP 中继；用户登录仍使用 `@disney.com` 收件验证

```text
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.sina.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=ddcarpool@sina.com
SMTP_PASS=<授权码，仅填云函数环境变量>
MAIL_FROM=DD Carpool <ddcarpool@sina.com>
```

> **勿**将授权码写入 Git 或小程序 `env.js`。

---

## 三点七、Outlook 个人版（Gmail 替代）

注册：https://outlook.live.com（大陆有时可访问）

```text
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=你的@outlook.com
SMTP_PASS=账户密码或应用密码（若开启 MFA）
MAIL_FROM=DD Carpool <你的@outlook.com>
```

---

## 三点八、个人 Gmail SMTP（需能访问 Google）

适合：能正常打开 Google 账号设置的环境。

### 1. 开启 Google 应用专用密码

1. https://myaccount.google.com → 开启 **两步验证**  
2. 生成 **应用专用密码** → 复制 16 位  

### 2. 云函数环境变量

```text
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=你的@gmail.com
SMTP_PASS=应用专用密码
MAIL_FROM=DD Carpool <你的@gmail.com>
```

---
## 三点九、Brevo 免费 SMTP（无域名备选）

1. 注册 https://www.brevo.com（若打不开可稍后试或改用 QQ 邮箱）  
2. 验证发件邮箱  
3. SMTP 设置页复制 login / key  

```text
MAIL_PROVIDER=smtp
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=（Brevo login）
SMTP_PASS=（Brevo SMTP key）
MAIL_FROM=DD Carpool <已验证邮箱>
```

免费档 **300 封/天**。

---

## 四、Resend 接入（备选）

若 IT 暂时无法提供 SMTP，可用 Resend 联调：

| 变量 | 说明 |
|------|------|
| `MAIL_PROVIDER` | `resend` |
| `RESEND_API_KEY` | Resend 控制台 API Key |
| `MAIL_FROM` | 联调可用 `onboarding@resend.dev` |

详见 Resend 文档；未验证域名时只能发到 Resend 注册邮箱。

---

## 五、安全要点

- 验证码校验在 **云函数 + 云库**，客户端不存真实验证码（`useCloudVerify: true` 时）  
- 仅允许 `@disney.com` 收件  
- SMTP 密码 / API Key **只在云函数环境变量**  
- 登录 session 30 天在本地；清缓存会退出  

---

## 六、上线前检查清单（⚠️ Crystal 上线前必做）

开发联调阶段可保持 **`USE_MOCK_EMAIL=true`**（页面显示预览码、不真发信）。**正式上线前**只需改配置，**一般不必改业务代码**：

| # | 项 | 开发（当前） | 上线前 |
|---|-----|-------------|--------|
| 1 | 云函数 `USE_MOCK_EMAIL` | `true` | **删除**或设为 `false` |
| 2 | 云函数 SMTP 变量 | 已配新浪 SMTP | 保留；有 IT 可换企业 SMTP |
| 3 | `miniprogram/config/env.js` | `useCloudVerify: true` | **保持 `true`** |
| 4 | 登录页预览文案 | 有 `mockCode` 时显示 | 上线后无 mockCode，**自动不显示** |
| 5 | 部署 | — | 改环境变量后 **Create && Deploy**  redeploy `authEmail` |
| 6 | 验收 | 页面预览码 | 真发到 `@disney.com` 收件箱 |

> **不需要改代码**，除非要上企业邮箱或隐藏预览相关 UI（当前已用 `wx:if="{{previewCode}}"` 控制）。

---

## 七、文件索引

| 文件 | 说明 |
|------|------|
| `cloudfunctions/authEmail/index.js` | send / verify |
| `cloudfunctions/authEmail/mailer.js` | SMTP + Resend |
| `modules/auth/verify.js` | 小程序调用云函数 |
| `modules/auth/session.js` | 30 天登录态 |
