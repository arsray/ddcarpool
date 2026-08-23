const app = getApp()
const auth = require('../../modules/auth/index')
const {
  FILTER_TABS,
  prepareOrderList
} = require('../../modules/auth/mock')

const NAV_TITLE = {
  passenger: '乘车人订单',
  owner: '车主订单',
  both: '我的订单'
}

Page({
  data: {
    role: 'owner',
    filter: '全部',
    filters: FILTER_TABS,
    orders: [],
    showOwnerTab: true,
    showPassengerTab: true,
    showRoleTabs: false,
    navTitle: NAV_TITLE.both
  },

  onLoad(options) {
    this.initRole(options.role)
  },

  onShow() {
    if (!auth.requireLogin()) return
    auth.store.initFromStorage()
    auth.store.syncGlobalData(app.globalData)
    this.initRole(this.data.role)
    this.loadList()
  },

  initRole(roleFromRoute) {
    const identities = app.globalData.identities || []
    const hasOwner = identities.includes('owner')
    const hasPassenger = identities.includes('passenger')
    let role = roleFromRoute || app.globalData.userMode || 'owner'

    if (role === 'owner' && !hasOwner && hasPassenger) role = 'passenger'
    if (role === 'passenger' && !hasPassenger && hasOwner) role = 'owner'

    let navTitle = NAV_TITLE.both
    if (hasOwner && !hasPassenger) navTitle = NAV_TITLE.owner
    else if (hasPassenger && !hasOwner) navTitle = NAV_TITLE.passenger

    this.setData({
      role,
      showOwnerTab: hasOwner,
      showPassengerTab: hasPassenger,
      showRoleTabs: hasOwner && hasPassenger,
      navTitle
    })

    wx.setNavigationBarTitle({ title: navTitle })
  },

  loadList() {
    const list = this.data.role === 'owner'
      ? app.globalData.historyOwner
      : app.globalData.historyPassenger
    this.setData({
      orders: prepareOrderList(list || [], this.data.filter, this.data.role)
    })
  },

  switchRole(e) {
    this.setData({ role: e.currentTarget.dataset.role, filter: '全部' })
    this.loadList()
  },

  onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter })
    this.loadList()
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/history-detail/history-detail?id=${e.currentTarget.dataset.id}&role=${this.data.role}`
    })
  }
})
