const app = getApp()
const auth = require('../../modules/auth/index')
const notification = require('../../modules/notification/index')
const { notificationMatchesRole, syncAppRole } = require('../../modules/auth/plaza-tab')

function formatRelativeTime(createdAt, fallback) {
  if (!createdAt) return fallback || ''
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  if (Number.isNaN(date.getTime())) return fallback || ''

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

  if (startOfDate.getTime() === startOfToday.getTime()) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  const diffDays = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / (24 * 60 * 60 * 1000))
  if (diffDays === 1) return '昨天'
  if (diffDays > 1) return `${diffDays}天前`
  return fallback || ''
}

function formatItem(item) {
  const time = formatRelativeTime(item.createdAt, item.time || '')
  return { ...item, id: item._id || item.id, time }
}

function resolveNotifyRole(targetType) {
  return targetType === 'owner' ? 'owner' : 'passenger'
}

Page({
  data: {
    list: [],
    loading: false,
    role: 'owner',
    showRoleTabs: false
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    notification.syncTabBarBadgeFromApp()
    if (!auth.requireLogin()) return
    app._syncAuth()
    this.initRole()
    await this.loadList()
  },

  initRole() {
    const identities = app.globalData.identities || []
    const hasOwner = identities.includes('owner')
    const hasPassenger = identities.includes('passenger')
    let role = app.globalData.userMode || 'owner'

    if (role === 'owner' && !hasOwner && hasPassenger) role = 'passenger'
    if (role === 'passenger' && !hasPassenger && hasOwner) role = 'owner'

    this.setData({
      role,
      showRoleTabs: hasOwner && hasPassenger
    })
  },

  async loadList() {
    this.setData({ loading: true })
    try {
      const list = await notification.refreshNotifications()
      const filtered = list
        .filter((item) => notificationMatchesRole(item, this.data.role))
        .map(formatItem)
      this.setData({ list: filtered })
    } catch (error) {
      notification.syncTabBarBadgeFromApp()
      wx.showToast({ title: '消息加载失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async switchRole(e) {
    const role = e.currentTarget.dataset.role
    if (role === this.data.role) return
    try {
      await syncAppRole(role)
      this.setData({ role })
      await this.loadList()
    } catch (error) {
      wx.showToast({ title: '切换失败，请重试', icon: 'none' })
    }
  },

  async onTap(e) {
    const item = this.data.list.find((n) => n.id === e.currentTarget.dataset.id)
    if (!item) return
    try {
      await notification.markRead(item.id)
      this.setData({
        list: this.data.list.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry)
      })
      notification.syncTabBarBadgeFromApp()
    } catch (error) {
      wx.showToast({ title: '消息状态更新失败', icon: 'none' })
    }
    if (item.targetId) {
      const role = resolveNotifyRole(item.targetType)
      wx.navigateTo({
        url: `/pages/detail/detail?orderId=${item.targetId}&from=history&role=${role}`
      })
    }
  }
})
