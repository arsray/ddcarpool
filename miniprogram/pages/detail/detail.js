const app = getApp()
const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const { formatDepartTimeDisplay } = require('../../modules/order/time-slots')

Page({
  data: {
    loading: true,
    submitting: false,
    order: null,
    routeLabel: '',
    statusLabel: '',
    departTimeLabel: '',
    isPassenger: false,
    isAssignedDriver: false,
    canAccept: false,
    canComplete: false,
    fromPlaza: false
  },

  onLoad(options) {
    this.setData({
      orderId: options.orderId || '',
      fromPlaza: options.from === 'plaza'
    })
  },

  onShow() {
    if (!auth.requireLogin()) return
    this.loadOrder()
  },

  async loadOrder() {
    if (!this.data.orderId) {
      wx.showToast({ title: '缺少订单 ID', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      auth.store.initFromStorage()
      auth.store.syncGlobalData(app.globalData)

      const item = await order.getOrderById(this.data.orderId)
      if (!item) {
        wx.showToast({ title: '订单不存在', icon: 'none' })
        this.setData({ loading: false, order: null })
        return
      }

      const openId = app.globalData.openId || (await auth.ensureLogin())
      const isPassenger = item.passengerOpenId === openId
      const isAssignedDriver = item.driverOpenId === openId
      const hasOwnerIdentity = app.hasIdentity('owner')
      const canAccept =
        item.status === order.ORDER_STATUS.MATCHING &&
        !isPassenger &&
        hasOwnerIdentity &&
        !item.driverOpenId
      const canComplete =
        isAssignedDriver &&
        (item.status === order.ORDER_STATUS.PENDING_DEPARTURE ||
          item.status === order.ORDER_STATUS.IN_PROGRESS)

      this.setData({
        loading: false,
        order: item,
        routeLabel: order.formatRoute(item.fromPointId, item.toPointId),
        statusLabel: order.STATUS_LABELS[item.status] || item.status,
        departTimeLabel: formatDepartTimeDisplay(item),
        isPassenger,
        isAssignedDriver,
        canAccept,
        canComplete
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onAccept() {
    if (!this.data.canAccept || this.data.submitting) return

    wx.showModal({
      title: '确认接单',
      content: '接单后订单将进入「待出发」，乘客会收到通知。',
      confirmText: '确认接单',
      success: (res) => {
        if (res.confirm) this.submitAccept()
      }
    })
  },

  async submitAccept() {
    this.setData({ submitting: true })
    try {
      const openId = await auth.ensureLogin()
      const profile = await auth.getProfile()
      await order.acceptOrder(this.data.orderId, {
        openId,
        name: (profile && profile.nickName) || app.globalData.userInfo.displayName || '司机'
      })

      auth.store.initFromStorage()
      auth.store.syncGlobalData(app.globalData)

      wx.showToast({ title: '接单成功', icon: 'success' })
      await this.loadOrder()
    } catch (error) {
      const messageMap = {
        ORDER_NOT_FOUND: '订单不存在',
        INVALID_STATUS: '订单当前不可接单',
        SELF_ACCEPT: '不能接自己的单',
        ALREADY_ACCEPTED: '订单已被接单',
        NOT_LOGGED_IN: '请先登录'
      }
      wx.showToast({
        title: messageMap[error.code] || error.message || '接单失败',
        icon: 'none'
      })
      await this.loadOrder()
    } finally {
      this.setData({ submitting: false })
    }
  },

  goHistory() {
    const role = this.data.isPassenger ? 'passenger' : 'owner'
    wx.navigateTo({ url: `/pages/history/history?role=${role}` })
  },

  backToPlaza() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onComplete() {
    if (!this.data.canComplete || this.data.submitting) return

    wx.showModal({
      title: '确认完成',
      content: '确认乘客已送达并完成本单？',
      confirmText: '完成',
      success: (res) => {
        if (res.confirm) this.submitComplete()
      }
    })
  },

  async submitComplete() {
    this.setData({ submitting: true })
    try {
      const openId = await auth.ensureLogin()
      await order.completeOrder(this.data.orderId, openId)

      auth.store.initFromStorage()
      auth.store.syncGlobalData(app.globalData)

      wx.showToast({ title: '订单已完成', icon: 'success' })
      await this.loadOrder()
    } catch (error) {
      const messageMap = {
        ORDER_NOT_FOUND: '订单不存在',
        INVALID_STATUS: '订单当前不可完成',
        FORBIDDEN: '仅接单司机可完成订单',
        NOT_LOGGED_IN: '请先登录'
      }
      wx.showToast({
        title: messageMap[error.code] || error.message || '操作失败',
        icon: 'none'
      })
      await this.loadOrder()
    } finally {
      this.setData({ submitting: false })
    }
  }
})
