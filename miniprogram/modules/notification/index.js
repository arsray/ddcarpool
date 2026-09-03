const config = require('../../config/index')
const { callFunction } = require('../../utils/cloud')

async function listNotifications() {
  if (config.useCloud) {
    return callFunction('notification', { action: 'list' })
  }
  return wx.getStorageSync('notifications') || []
}

async function markRead(notificationId) {
  if (config.useCloud) {
    return callFunction('notification', { action: 'markRead', notificationId })
  }
  const list = wx.getStorageSync('notifications') || []
  const next = list.map((item) => item.id === notificationId || item._id === notificationId
    ? { ...item, read: true }
    : item)
  wx.setStorageSync('notifications', next)
  return { notificationId, read: true }
}

module.exports = {
  listNotifications,
  markRead
}
