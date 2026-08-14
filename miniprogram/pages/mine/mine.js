const app = getApp()
const auth = require('../../modules/auth/index')
const { getOngoingOrders } = require('../../modules/auth/mock')
const { formatPreferenceSummary } = require('../../modules/auth/vehicle-data')
const { safeReLaunch, isTopPage } = require('../../modules/auth/nav')

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
    unreadCount: 0,
    avatarLetter: 'J'
  },

  onShow() {
    if (!isTopPage('pages/mine/mine')) return
    if (!auth.requireLogin()) return
    if (!app.globalData.onboardingComplete || !app.globalData.identities.length) {
      safeReLaunch('/pages/onboarding/identity/identity')
      return
    }
    this.refresh()
  },

  refresh() {
    const g = app.globalData
    const identities = g.identities || []
    const isOwner = g.userMode === 'owner'
    const hasBoth = identities.includes('owner') && identities.includes('passenger')
    const list = isOwner ? (g.historyOwner || []) : (g.historyPassenger || [])
    const unfinishedCount = getOngoingOrders(list).length

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
      unreadCount: (g.notifications || []).filter((n) => !n.read).length,
      avatarLetter: (g.userInfo.displayName || 'U').charAt(0).toUpperCase()
    })
  },

  onSwitchMode() {
    const next = this.data.isOwner ? 'passenger' : 'owner'
    if (!app.hasIdentity(next)) {
      wx.showToast({ title: '请先添加该身份', icon: 'none' })
      return
    }
    app.setUserMode(next)
    this.refresh()
    wx.showToast({
      title: next === 'owner' ? '已切换为车主模式' : '已切换为乘车人模式',
      icon: 'none'
    })
  },

  goVehicle() { wx.navigateTo({ url: '/pages/vehicle/vehicle' }) },
  goHabitTags() { wx.navigateTo({ url: '/pages/habit-tags/habit-tags' }) },
  goPreference() { wx.navigateTo({ url: '/pages/preference/preference' }) },
  goHistory() {
    wx.navigateTo({ url: `/pages/history/history?role=${this.data.isOwner ? 'owner' : 'passenger'}` })
  },
  goAccount() { wx.navigateTo({ url: '/pages/account/account' }) },
  goNotify() { wx.navigateTo({ url: '/pages/notify/notify' }) }
})
