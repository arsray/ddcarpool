/**
 * 按邮箱账号（acct_*）隔离本地运行时与缓存，避免同微信多账号串数据
 */

const { getSessionAccountId } = require('./session')

const LEGACY_NOTIFICATIONS_KEY = 'notifications'

function getActiveAccountId() {
  return getSessionAccountId() || ''
}

function notificationsStorageKey(accountId) {
  const id = String(accountId || getActiveAccountId() || '').trim()
  return id ? `${LEGACY_NOTIFICATIONS_KEY}_${id}` : LEGACY_NOTIFICATIONS_KEY
}

function clearLegacyNotificationsStorage() {
  try {
    wx.removeStorageSync(LEGACY_NOTIFICATIONS_KEY)
  } catch (error) {
    // ignore
  }
}

function clearAllNotificationsStorage() {
  clearLegacyNotificationsStorage()
  try {
    const info = wx.getStorageInfoSync()
    ;(info.keys || []).forEach((key) => {
      if (key.startsWith(`${LEGACY_NOTIFICATIONS_KEY}_`)) {
        wx.removeStorageSync(key)
      }
    })
  } catch (error) {
    // ignore
  }
}

function clearAccountScopedAppData() {
  try {
    const app = getApp()
    if (app && app.globalData) {
      app.globalData.notifications = []
      app.globalData.cloudOrders = []
      app.globalData.historyOwner = []
      app.globalData.historyPassenger = []
    }
  } catch (error) {
    // App 尚未就绪
  }
}

module.exports = {
  LEGACY_NOTIFICATIONS_KEY,
  getActiveAccountId,
  notificationsStorageKey,
  clearLegacyNotificationsStorage,
  clearAllNotificationsStorage,
  clearAccountScopedAppData
}
