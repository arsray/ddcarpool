const { normalizeEmail } = require('./email')
const config = require('../../config/index')
const { callFunction } = require('../../utils/cloud')

const COOLDOWN_MS = 60 * 1000
const EXPIRE_MS = 10 * 60 * 1000
const CODE_LEN = 6
const previewCodes = Object.create(null)

function storageKey(email) {
  return `verify_${normalizeEmail(email)}`
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function sendCodeLocal(email) {
  const normalized = normalizeEmail(email)
  const key = storageKey(normalized)
  const now = Date.now()
  const existing = wx.getStorageSync(key)

  if (existing && existing.sentAt && now - existing.sentAt < COOLDOWN_MS) {
    const remain = Math.ceil((COOLDOWN_MS - (now - existing.sentAt)) / 1000)
    return { ok: false, code: 'cooldown', remain, message: `${remain}s 后可重新获取` }
  }

  const code = generateCode()
  previewCodes[normalized] = code
  wx.setStorageSync(key, {
    email: normalized,
    sentAt: now,
    expiresAt: now + EXPIRE_MS,
    mode: 'mock'
  })

  return { ok: true, code, mode: 'mock', message: '开发预览验证码已生成' }
}

async function sendCode(email) {
  const normalized = normalizeEmail(email)
  if (config.useCloud && !config.allowMockEmailVerification) {
    const data = await callFunction('emailAuth', {
      action: 'requestCode',
      email: normalized
    })
    wx.setStorageSync(storageKey(normalized), {
      email: normalized,
      sentAt: Date.now(),
      expiresAt: Date.now() + EXPIRE_MS,
      mode: 'smtp'
    })
    return { ok: true, code: '', mode: 'smtp', data, message: '验证码已发送至您的邮箱，请查收' }
  }

  return sendCodeLocal(email)
}

function getCooldownRemain(email) {
  const existing = wx.getStorageSync(storageKey(email))
  if (!existing || !existing.sentAt) return 0
  const remain = COOLDOWN_MS - (Date.now() - existing.sentAt)
  return remain > 0 ? Math.ceil(remain / 1000) : 0
}

function hasSentCode(email) {
  const existing = wx.getStorageSync(storageKey(email))
  if (!existing || !existing.sentAt) return false
  return Date.now() < existing.expiresAt
}

function verifyCodeLocal(email, input) {
  const normalized = normalizeEmail(email)
  const key = storageKey(normalized)
  const record = wx.getStorageSync(key)

  if (!record || !record.sentAt) {
    return { ok: false, message: '请先获取验证码' }
  }
  if (Date.now() > record.expiresAt) {
    wx.removeStorageSync(key)
    delete previewCodes[normalized]
    return { ok: false, message: '验证码错误或已过期，请重新获取' }
  }
  if (!input || !/^\d{6}$/.test(input)) {
    return { ok: false, message: '请输入 6 位数字验证码' }
  }
  if (input !== previewCodes[normalized]) {
    return { ok: false, message: '验证码错误或已过期，请重新获取' }
  }

  wx.removeStorageSync(key)
  delete previewCodes[normalized]
  return { ok: true, email: normalized, mode: 'mock' }
}

async function verifyCode(email, input) {
  const normalized = normalizeEmail(email)
  if (config.useCloud && !config.allowMockEmailVerification) {
    if (!input || !/^\d{6}$/.test(input)) {
      return { ok: false, message: '请输入 6 位数字验证码' }
    }
    try {
      await callFunction('emailAuth', {
        action: 'verifyCode',
        email: normalized,
        code: input
      })
      wx.removeStorageSync(storageKey(normalized))
      return { ok: true, email: normalized, mode: 'smtp' }
    } catch (error) {
      return { ok: false, code: error.code, message: error.message || '验证码错误或已过期' }
    }
  }

  return verifyCodeLocal(email, input)
}

module.exports = {
  COOLDOWN_MS,
  EXPIRE_MS,
  CODE_LEN,
  sendCode,
  sendCodeLocal,
  verifyCode,
  verifyCodeLocal,
  getCooldownRemain,
  hasSentCode
}
