const app = getApp()
const { requireLogin } = require('../../../utils/util')

Page({
  data: {
    selected: '',
    mode: 'onboarding',
    pageTitle: '选择你的身份',
    pageSub: '注册完成后，先选择一种身份开始使用',
    autoAdding: false
  },

  onLoad(options) {
    const mode = options.mode || 'onboarding'
    const isAdd = mode === 'add'

    if (isAdd) {
      const missing = app.getMissingIdentity()
      const identities = app.globalData.identities || []
      if (missing && identities.length === 1) {
        this.setData({ mode, autoAdding: true, pageTitle: '添加身份', pageSub: '正在为你添加另一种身份…' })
        this.autoAddIdentity(missing)
        return
      }
    }

    this.setData({
      mode,
      pageTitle: isAdd ? '添加身份' : '选择你的身份',
      pageSub: isAdd ? '每次只能添加一种身份' : '注册完成后，先选择一种身份开始使用'
    })
  },

  onShow() {
    if (!requireLogin()) return
  },

  async autoAddIdentity(role) {
    try {
      await app.addIdentity(role)
      const setupUrl = role === 'owner'
        ? '/pages/vehicle/vehicle?setup=1'
        : '/pages/preference/preference?setup=1'
      wx.redirectTo({ url: setupUrl })
    } catch (error) {
      wx.showToast({ title: '添加身份失败，请重试', icon: 'none' })
      wx.navigateBack()
    }
  },

  onSelect(e) {
    const role = e.currentTarget.dataset.role
    const { mode } = this.data

    if (mode === 'add' && app.hasIdentity(role)) {
      wx.showToast({ title: '你已拥有该身份', icon: 'none' })
      return
    }

    this.setData({ selected: role })
  },

  async onNext() {
    const { selected, mode } = this.data
    if (!selected) return

    if (mode === 'add' && app.hasIdentity(selected)) {
      wx.showToast({ title: '你已拥有该身份', icon: 'none' })
      return
    }

    try {
      await app.addIdentity(selected)
      const query = mode === 'add' ? 'setup=1' : 'onboarding=1'
      const setupUrl = selected === 'owner'
        ? `/pages/vehicle/vehicle?${query}`
        : `/pages/preference/preference?${query}`
      wx.navigateTo({ url: setupUrl })
    } catch (error) {
      wx.showToast({ title: '保存身份失败，请重试', icon: 'none' })
    }
  }
})
