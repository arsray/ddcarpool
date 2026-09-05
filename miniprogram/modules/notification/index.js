const config = require('../../config/index')
const { callFunction } = require('../../utils/cloud')

function countUnread(notifications) {
  return (notifications || []).filter((item) => !item.read).length
}

function syncTabBarBadge(notifications) {
  const unreadCount = countUnread(notifications)
  try {
    const pages = getCurrentPages()
    const page = pages[pages.length - 1]
    if (page && typeof page.getTabBar === 'function') {
      const tabBar = page.getTabBar()
      if (tabBar && typeof tabBar.setUnreadCount === 'function') {
        tabBar.setUnreadCount(unreadCount)
      }
    }
  } catch (error) {
    // Tab 页尚未挂载时忽略。
  }
  return unreadCount
}

function syncTabBarBadgeFromApp() {
  try {
    const app = getApp()
    return syncTabBarBadge(app && app.globalData ? app.globalData.notifications : [])
  } catch (error) {
    return 0
  }
}

function applyNotifications(notifications) {
  const list = Array.isArray(notifications) ? notifications : []
  try {
    const app = getApp()
    if (app && app.globalData) app.globalData.notifications = list
  } catch (error) {
    // App 尚未就绪时仅写 store。
  }
  if (config.useCloud) {
    const cloudStore = require('../auth/cloud-store')
    if (cloudStore.setNotifications) cloudStore.setNotifications(list)
  } else {
    wx.setStorageSync('notifications', list)
    const store = require('../auth/store')
    store.getState().notifications = list
  }
  syncTabBarBadge(list)
  return list
}

async function listNotifications() {
  if (config.useCloud) {
    return callFunction('notification', { action: 'list' })
  }
  return wx.getStorageSync('notifications') || []
}

async function refreshNotifications() {
  const list = await listNotifications()
  return applyNotifications(list)
}

async function markRead(notificationId) {
  if (config.useCloud) {
    await callFunction('notification', { action: 'markRead', notificationId })
    const app = getApp()
    const next = (app.globalData.notifications || []).map((item) =>
      item.id === notificationId || item._id === notificationId
        ? { ...item, read: true }
        : item
    )
    applyNotifications(next)
    return { notificationId, read: true }
  }
  const list = wx.getStorageSync('notifications') || []
  const next = list.map((item) => item.id === notificationId || item._id === notificationId
    ? { ...item, read: true }
    : item)
  applyNotifications(next)
  return { notificationId, read: true }
}

module.exports = {
  countUnread,
  syncTabBarBadge,
  syncTabBarBadgeFromApp,
  applyNotifications,
  listNotifications,
  refreshNotifications,
  markRead
}
