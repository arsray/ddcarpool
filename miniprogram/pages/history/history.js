const app = getApp()
const auth = require('../../modules/auth/index')
const config = require('../../config/index')
const order = require('../../modules/order/index')
const { toHistoryItem, toOwnerHistoryItem } = require('../../modules/order/history-bridge')
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

  async onShow() {
    if (!auth.requireLogin()) return
    app._syncAuth()
    this.initRole(this.data.role)
    await this.loadList()
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

  async loadList() {
    if (config.useCloud) {
      try {
        const openId = await auth.ensureLogin()
        const role = this.data.role === 'owner' ? 'driver' : 'passenger'
        const list = await order.listOrdersForUser(openId, { role })
        const mapped = list.map(this.data.role === 'owner' ? toOwnerHistoryItem : toHistoryItem)
        this.setData({
          orders: prepareOrderList(mapped, this.data.filter, this.data.role)
        })
      } catch (error) {
        wx.showToast({ title: '订单加载失败', icon: 'none' })
      }
      return
    }
    const list = this.data.role === 'owner'
      ? app.globalData.historyOwner
      : app.globalData.historyPassenger
    this.setData({
      orders: prepareOrderList(list || [], this.data.filter, this.data.role)
    })
  },

  async switchRole(e) {
    this.setData({ role: e.currentTarget.dataset.role, filter: '全部' })
    await this.loadList()
  },

  async onFilter(e) {
    this.setData({ filter: e.currentTarget.dataset.filter })
    await this.loadList()
  },

  goDetail(e) {
    wx.navigateTo({
      url: `/pages/detail/detail?orderId=${e.currentTarget.dataset.id}&from=history`
    })
  }
})
