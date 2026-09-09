/**
 * M1 — 发信适配：SMTP（企业邮箱） / Resend（API）
 */
const nodemailer = require('nodemailer')

function buildMailContent(code) {
  return {
    subject: 'DD 蹭车 — 登录验证码',
    text: `您的登录验证码是：${code}\n10 分钟内有效，请勿泄露。`,
    html: `<p>您的登录验证码是：<strong>${code}</strong></p><p>10 分钟内有效，请勿泄露。</p>`
  }
}

function getFromAddress() {
  return process.env.MAIL_FROM || 'DD Carpool <noreply@disney.com>'
}

function isSmtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function createSmtpTransport() {
  const port = Number(process.env.SMTP_PORT || 587)
  const secure = process.env.SMTP_SECURE === 'true' || port === 465

  // SECURITY-REVIEW: SMTP 凭据仅来自云函数环境变量，不下发客户端
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      minVersion: 'TLSv1.2',
      rejectUnauthorized: process.env.SMTP_TLS_INSECURE !== 'true'
    }
  })
}

async function sendViaSmtp(to, code) {
  try {
    const transport = createSmtpTransport()
    const content = buildMailContent(code)
    await transport.sendMail({
      from: getFromAddress(),
      to,
      subject: content.subject,
      text: content.text,
      html: content.html
    })
    return { ok: true }
  } catch (e) {
    console.error('[authEmail] SMTP send failed')
    return { ok: false, code: 'MAIL_SEND_FAILED', message: '验证码发送失败，请稍后重试' }
  }
}

async function sendViaResend(apiKey, to, code) {
  try {
    const content = buildMailContent(code)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: [to],
        subject: content.subject,
        html: content.html
      })
    })
    if (!response.ok) {
      return { ok: false, code: 'MAIL_SEND_FAILED', message: '验证码发送失败，请稍后重试' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, code: 'MAIL_SEND_FAILED', message: '验证码发送失败，请稍后重试' }
  }
}

async function dispatchMail(to, code) {
  const provider = (process.env.MAIL_PROVIDER || '').trim().toLowerCase()

  if (provider === 'smtp' || (!provider && isSmtpConfigured())) {
    if (!isSmtpConfigured()) {
      return { ok: false, code: 'MAIL_NOT_CONFIGURED', message: 'SMTP 未配置完整' }
    }
    return sendViaSmtp(to, code)
  }

  if (provider === 'resend' || process.env.RESEND_API_KEY) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return { ok: false, code: 'MAIL_NOT_CONFIGURED', message: 'Resend 未配置' }
    }
    return sendViaResend(apiKey, to, code)
  }

  return { ok: false, code: 'MAIL_NOT_CONFIGURED', message: '邮件服务未配置' }
}

module.exports = {
  dispatchMail,
  isSmtpConfigured
}
