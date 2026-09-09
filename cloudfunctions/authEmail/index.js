/**
 * M1 — 邮箱验证码发送 / 校验（云函数）
 *
 * 发信方式（二选一，云函数环境变量）：
 *   SMTP — 见 docs/M1_EMAIL_AUTH.md § SMTP
 *   Resend — RESEND_API_KEY + MAIL_FROM
 *
 * 通用：
 *   USE_MOCK_EMAIL=true  只写库不真发（联调）
 *   MAIL_PROVIDER=smtp|resend  可选，默认有 SMTP 配置则走 SMTP
 *
 * 数据库集合 verify_codes（仅云函数可读写）
 */
const cloud = require('wx-server-sdk')
const { dispatchMail } = require('./mailer')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const VERIFY_COLLECTION = 'verify_codes'
const COOLDOWN_MS = 60 * 1000
const CODE_TTL_MS = 10 * 60 * 1000

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}

async function sendCode(email) {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.endsWith('@disney.com')) {
    return { ok: false, code: 'INVALID_EMAIL', message: '仅支持 @disney.com 邮箱' }
  }

  const now = Date.now()
  const existing = await db.collection(VERIFY_COLLECTION).where({ email: normalized }).limit(1).get()
  const record = existing.data && existing.data[0]

  if (record && record.sentAt && now - record.sentAt < COOLDOWN_MS) {
    const remain = Math.ceil((COOLDOWN_MS - (now - record.sentAt)) / 1000)
    return { ok: false, code: 'cooldown', remain, message: `${remain}s 后可重新获取` }
  }

  const code = generateCode()
  const payload = { email: normalized, code, sentAt: now, expiresAt: now + CODE_TTL_MS }

  if (record && record._id) {
    await db.collection(VERIFY_COLLECTION).doc(record._id).update({ data: payload })
  } else {
    await db.collection(VERIFY_COLLECTION).add({ data: payload })
  }

  if (process.env.USE_MOCK_EMAIL === 'true') {
    return { ok: true, message: '验证码已发送至您的邮箱，请查收', mockCode: code }
  }

  const sendResult = await dispatchMail(normalized, code)
  if (!sendResult.ok) {
    return sendResult
  }

  return { ok: true, message: '验证码已发送至您的邮箱，请查收' }
}

async function verifyCode(email, input) {
  const normalized = normalizeEmail(email)
  const existing = await db.collection(VERIFY_COLLECTION).where({ email: normalized }).limit(1).get()
  const record = existing.data && existing.data[0]

  if (!record || !record.sentAt) {
    return { ok: false, message: '请先获取验证码' }
  }
  if (Date.now() > record.expiresAt) {
    if (record._id) await db.collection(VERIFY_COLLECTION).doc(record._id).remove()
    return { ok: false, message: '验证码错误或已过期，请重新获取' }
  }
  if (!input || !/^\d{6}$/.test(String(input))) {
    return { ok: false, message: '请输入 6 位数字验证码' }
  }
  if (String(input) !== String(record.code)) {
    return { ok: false, message: '验证码错误或已过期，请重新获取' }
  }

  if (record._id) await db.collection(VERIFY_COLLECTION).doc(record._id).remove()
  return { ok: true, email: normalized }
}

exports.main = async (event) => {
  const action = event && event.action
  if (action === 'send') return sendCode(event.email)
  if (action === 'verify') return verifyCode(event.email, event.code)
  return { ok: false, message: 'unknown action' }
}
