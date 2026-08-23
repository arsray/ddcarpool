const app = getApp()
const auth = require('../../modules/auth/index')
const { safeSwitchTab } = require('../../modules/auth/nav')

Page({
  data: {
    userInfo: {},
    phoneText: '未绑定 · 可选',
    identitySummary: '',
    mockUsers: [],
    currentEmail: ''
  },

  onShow() {
    if (!auth.requireLogin()) return
    auth.store.initFromStorage()
    auth.store.syncGlobalData(app.globalData)
    this.refresh()
  },

  refresh() {
    const u = app.globalData.userInfo || {}
    const identities = app.globalData.identities || []
    const labels = identities.map((role) => (role === 'owner' ? '车主' : '乘车人'))
    this.setData({
      userInfo: u,
      phoneText: u.phone || '未绑定 · 可选',
      identitySummary: labels.length ? labels.join('、') : '未设置',
      mockUsers: app.listMockTestUsers(),
      currentEmail: u.email || ''
    })
  },

  goIdentityManage() {
    wx.navigateTo({ url: '/pages/identity-manage/identity-manage' })
  },

  viewAgreement() {
    wx.showToast({ title: '协议预览占位', icon: 'none' })
  },

  onSwitchMockUser(e) {
    const email = e.currentTarget.dataset.email
    if (!email || email === this.data.currentEmail) return

    try {
      const preset = app.switchMockUser(email)
      wx.showToast({ title: `已切换为 ${preset.label}`, icon: 'none' })
      setTimeout(() => safeSwitchTab('/pages/mine/mine'), 400)
    } catch (error) {
      wx.showToast({ title: '切换失败', icon: 'none' })
    }
  },

  onLogout() {
    app.logout()
    wx.reLaunch({ url: '/pages/login/login' })
  }
})
