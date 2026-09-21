/**
 * 登录会话 — 30 天有效（M1）
 * 验证码本身仍 10 分钟过期（verify.js）
 * accountId = 邮箱 derived acct_*，与微信 OPENID 解耦
 */

const SESSION_STORAGE_KEY = 'authSession'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

function writeSession(email, accountId) {
  const normalized = (email || '').trim().toLowerCase()
  wx.setStorageSync('loggedIn', true)
  wx.setStorageSync(SESSION_STORAGE_KEY, {
    email: normalized,
    accountId: accountId ? String(accountId).trim() : '',
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
  const cache = wx.getStorageSync('cloudUserCache')

  if (session && session.expiresAt) {
    if (Date.now() > session.expiresAt) {
      clearSession()
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('cloudUserCache')
      return false
    }
    const hasAccount =
      (session.accountId && String(session.accountId).trim()) ||
      (cache && cache.openId) ||
      (userInfo && userInfo.email)
    return !!wx.getStorageSync('loggedIn') && !!hasAccount
  }

  return !!wx.getStorageSync('loggedIn') && !!userInfo
}

function getSessionRemainingDays() {
  const session = readSession()
  if (!session || !session.expiresAt) return null
  const remainMs = session.expiresAt - Date.now()
  if (remainMs <= 0) return 0
  return Math.ceil(remainMs / (24 * 60 * 60 * 1000))
}

function getSessionAccountId() {
  const session = readSession()
  if (session && session.accountId) return String(session.accountId).trim()
  try {
    const cache = wx.getStorageSync('cloudUserCache')
    if (cache && cache.openId) return String(cache.openId).trim()
  } catch (error) {
    // ignore
  }
  return ''
}

module.exports = {
  SESSION_STORAGE_KEY,
  SESSION_TTL_MS,
  writeSession,
  clearSession,
  readSession,
  isSessionValid,
  getSessionRemainingDays,
  getSessionAccountId
}
