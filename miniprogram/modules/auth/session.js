/**
 * 登录会话 — 30 天有效（M1）
 * 验证码本身仍 10 分钟过期（verify.js）
 */

const SESSION_STORAGE_KEY = 'authSession'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

function writeSession(email) {
  const normalized = (email || '').trim().toLowerCase()
  wx.setStorageSync('loggedIn', true)
  wx.setStorageSync(SESSION_STORAGE_KEY, {
    email: normalized,
    expiresAt: Date.now() + SESSION_TTL_MS,
    createdAt: Date.now()
  })
}

function clearSession() {
  wx.removeStorageSync('loggedIn')
  wx.removeStorageSync(SESSION_STORAGE_KEY)
}

function readSession() {
  return wx.getStorageSync(SESSION_STORAGE_KEY) || null
}

function isSessionValid() {
  const session = readSession()
  const userInfo = wx.getStorageSync('userInfo')

  if (session && session.expiresAt) {
    if (Date.now() > session.expiresAt) {
      clearSession()
      wx.removeStorageSync('userInfo')
      return false
    }
    return !!wx.getStorageSync('loggedIn') && !!userInfo
  }

  // 兼容旧版：仅有 loggedIn 无 session 记录时视为有效，下次登录会写入 session
  return !!wx.getStorageSync('loggedIn') && !!userInfo
}

function getSessionRemainingDays() {
  const session = readSession()
  if (!session || !session.expiresAt) return null
  const remainMs = session.expiresAt - Date.now()
  if (remainMs <= 0) return 0
  return Math.ceil(remainMs / (24 * 60 * 60 * 1000))
}

module.exports = {
  SESSION_STORAGE_KEY,
  SESSION_TTL_MS,
  writeSession,
  clearSession,
  readSession,
  isSessionValid,
  getSessionRemainingDays
}
