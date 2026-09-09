const app = getApp()
const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const { getOngoingOrders } = require('../../modules/auth/mock')
const { formatPreferenceSummary } = require('../../modules/auth/vehicle-data')
const { initialsFromEmailLocalPart } = require('../../modules/auth/email')
const { safeReLaunch, isTopPage } = require('../../modules/auth/nav')
const { notificationMatchesRole, ensureCorrectPlazaPage, syncAppRole } = require('../../modules/auth/plaza-tab')
const config = require('../../config/index')
const notification = require('../../modules/notification/index')

const ONGOING_CLOUD = ['matching', 'pending_departure', 'in_progress']

Page({
  data: {
    userInfo: null,
    isOwner: true,
    modeLabel: '车主模式',
    switchLabel: '切换乘车人',
    hasBothIdentities: false,
    hasVehicle: false,
    hasPreference: false,
    vehicle: {},
    preference: {},
    habitSummary: '',
    unfinishedCount: 0,
    unfinishedLabel: '车主未完成订单',
    unreadCount: 0,
    avatarInitials: 'U'
  },

  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    notification.syncTabBarBadgeFromApp()
    if (!isTopPage('pages/mine/mine')) return
    if (!auth.requireLogin()) return
    if (config.useCloud) {
      try {
        await auth.getProfile()
      } catch (error) {
        console.warn('[mine] profile load failed', error)
        wx.showToast({ title: '个人资料加载失败', icon: 'none' })
      }
      try {
        await this.reloadCloudOrders()
      } catch (error) {
        console.warn('[mine] orders load failed', error)
        wx.showToast({ title: '订单加载失败', icon: 'none' })
      }
    }
    app._syncAuth()
    if (!app.globalData.onboardingComplete || !app.globalData.identities.length) {
      safeReLaunch('/pages/onboarding/identity/identity')
      return
    }
    this.refresh()
  },

  async reloadCloudOrders() {
    const openId = await auth.ensureLogin()
    const role = app.globalData.userMode === 'owner' ? 'driver' : 'passenger'
    const [orders, notifications] = await Promise.all([
      order.listOrdersForUser(openId, { role }),
      notification.refreshNotifications()
    ])
    app.globalData.cloudOrders = orders
    app.globalData.notifications = notifications
  },

  refresh() {
    const g = app.globalData
    const identities = g.identities || []
    const isOwner = g.userMode === 'owner'
    const hasBoth = identities.includes('owner') && identities.includes('passenger')
    const currentRole = isOwner ? 'owner' : 'passenger'
    const list = isOwner ? (g.historyOwner || []) : (g.historyPassenger || [])

    let unfinishedCount = 0
    if (config.useCloud) {
      unfinishedCount = (g.cloudOrders || []).filter((item) =>
        ONGOING_CLOUD.includes(item.status)
      ).length
    } else {
      unfinishedCount = getOngoingOrders(list).length
    }

    const unreadCount = (g.notifications || []).filter(
      (item) => !item.read && notificationMatchesRole(item, currentRole)
    ).length

    this.setData({
      userInfo: g.userInfo,
      isOwner,
      hasBothIdentities: hasBoth,
      modeLabel: isOwner ? '车主模式' : '乘车人模式',
      switchLabel: isOwner ? '切换乘车人' : '切换车主',
      vehicle: g.vehicle || {},
      preference: g.preference || { defaultCount: 1, note: '' },
      hasVehicle: !!(g.vehicle && g.vehicle.plate),
      hasPreference: !!g.preference,
      preferenceSummary: formatPreferenceSummary(g.preference),
      habitSummary: (g.habitTags || []).join(' · ') || '未设置',
      unfinishedCount,
      unfinishedLabel: isOwner ? '车主未完成订单' : '乘车人未完成订单',
      unreadCount,
      avatarInitials: initialsFromEmailLocalPart(g.userInfo && g.userInfo.email)
    })
  },

  async onSwitchMode() {
    if (!this.data.hasBothIdentities) return
    const role = this.data.isOwner ? 'passenger' : 'owner'
    try {
      await syncAppRole(role)
      if (config.useCloud) {
        await this.reloadCloudOrders()
      }
      ensureCorrectPlazaPage()
      this.refresh()
    } catch (error) {
      wx.showToast({ title: '切换失败，请重试', icon: 'none' })
    }
  },

  goVehicle() { wx.navigateTo({ url: '/pages/vehicle/vehicle' }) },
  goHabitTags() { wx.navigateTo({ url: '/pages/habit-tags/habit-tags' }) },
  goPreference() { wx.navigateTo({ url: '/pages/preference/preference' }) },
  goHistory() {
    wx.navigateTo({ url: `/pages/history/history?role=${this.data.isOwner ? 'owner' : 'passenger'}` })
  },
  goAccount() { wx.navigateTo({ url: '/pages/account/account' }) },
  goNotify() { wx.switchTab({ url: '/pages/notify/notify' }) }
})
