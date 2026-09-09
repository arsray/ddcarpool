const app = getApp()
const { requireLogin } = require('../../utils/util')
const { syncAppRole } = require('../../modules/auth/plaza-tab')

Page({
  data: {
    identities: [],
    userMode: 'owner',
    hasBothIdentities: false,
    singleRole: 'owner',
    missingRole: '',
    addButtonLabel: ''
  },

  onShow() {
    if (!requireLogin()) return
    this.refresh()
  },

  refresh() {
    const identities = app.globalData.identities || []
    const hasBothIdentities = identities.includes('owner') && identities.includes('passenger')
    const missingRole = app.getMissingIdentity()
    const addButtonLabel = missingRole === 'owner'
      ? '+ 添加车主身份'
      : missingRole === 'passenger'
        ? '+ 添加乘车人身份'
        : ''

    this.setData({
      identities,
      userMode: app.globalData.userMode,
      hasBothIdentities,
      singleRole: identities.includes('owner') ? 'owner' : 'passenger',
      missingRole,
      addButtonLabel
    })
  },

  async onSwitchIdentity(e) {
    const role = e.currentTarget.dataset.role
    if (!role || role === this.data.userMode) return

    try {
      await syncAppRole(role)
      this.refresh()
      wx.showToast({
        title: role === 'owner' ? '已切换为车主' : '已切换为乘车人',
        icon: 'none'
      })
    } catch (error) {
      wx.showToast({ title: '切换失败，请重试', icon: 'none' })
    }
  },

  onAdd() {
    const role = app.getMissingIdentity()
    if (!role) return

    const label = role === 'owner' ? '车主' : '乘车人'
    wx.showModal({
      title: `添加${label}身份`,
      content: `添加后可在「我的身份」中点击切换，是否继续？`,
      confirmText: '添加',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.addIdentity(role)
          const url = role === 'owner'
            ? '/pages/vehicle/vehicle?setup=1'
            : '/pages/preference/preference?setup=1'
          wx.navigateTo({ url })
        } catch (error) {
          wx.showToast({ title: '添加身份失败，请重试', icon: 'none' })
        }
      }
    })
  }
})
