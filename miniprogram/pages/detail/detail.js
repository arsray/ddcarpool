const app = getApp()
const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const { formatDepartTimeDisplay } = require('../../modules/order/time-slots')
const {
  resolveCancelAction,
  getCancelModalConfig,
  getCancelSuccessTitle,
  getCancelButtonLabel,
  CANCEL_ERROR_MESSAGES
} = order

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
    canStart: false,
    canComplete: false,
    canChat: false,
    canCancel: false,
    cancelKind: '',
    cancelButtonLabel: '',
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
      app._syncAuth()

      const item = await order.getOrderById(this.data.orderId)
      if (!item) {
        wx.showToast({ title: '订单不存在', icon: 'none' })
        this.setData({ loading: false, order: null })
        return
      }

      const openId = app.globalData.openId || (await auth.ensureLogin())
      const isPassenger = item.viewerRole
        ? item.viewerRole === 'passenger'
        : item.passengerOpenId === openId
      const isAssignedDriver = item.viewerRole
        ? item.viewerRole === 'driver'
        : item.driverOpenId === openId
      const hasOwnerIdentity = app.hasIdentity('owner')
      const canAccept =
        item.status === order.ORDER_STATUS.MATCHING &&
        !isPassenger &&
        hasOwnerIdentity &&
        !item.driverOpenId &&
        !item.viewerRole
      const canComplete =
        isAssignedDriver &&
        (item.status === order.ORDER_STATUS.PENDING_DEPARTURE ||
          item.status === order.ORDER_STATUS.IN_PROGRESS)
      const canStart =
        isAssignedDriver &&
        item.status === order.ORDER_STATUS.PENDING_DEPARTURE
      const canChat =
        (isPassenger || isAssignedDriver) &&
        [order.ORDER_STATUS.PENDING_DEPARTURE, order.ORDER_STATUS.IN_PROGRESS].includes(item.status)
      const cancelKind = resolveCancelAction(item, openId)

      this.setData({
        loading: false,
        order: item,
        routeLabel: order.formatRoute(item.fromPointId, item.toPointId),
        statusLabel: order.STATUS_LABELS[item.status] || item.status,
        departTimeLabel: formatDepartTimeDisplay(item),
        isPassenger,
        isAssignedDriver,
        canAccept,
        canStart,
        canComplete,
        canChat,
        canCancel: !!cancelKind,
        cancelKind: cancelKind || '',
        cancelButtonLabel: cancelKind ? getCancelButtonLabel(cancelKind) : ''
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

      app._syncAuth()

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

  goChat() {
    wx.navigateTo({ url: `/pages/chat/chat?orderId=${this.data.orderId}` })
  },

  async onStart() {
    if (!this.data.canStart || this.data.submitting) return
    this.setData({ submitting: true })
    try {
      await order.startTrip(this.data.orderId, await auth.ensureLogin())
      wx.showToast({ title: '行程已开始', icon: 'success' })
      await this.loadOrder()
    } catch (error) {
      wx.showToast({ title: error.message || '操作失败', icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  },

  backToPlaza() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  onCancel() {
    if (!this.data.canCancel || this.data.submitting) return

    const modal = getCancelModalConfig(this.data.cancelKind)
    if (!modal) return

    wx.showModal({
      ...modal,
      success: (res) => {
        if (res.confirm) this.submitCancel()
      }
    })
  },

  async submitCancel() {
    this.setData({ submitting: true })
    try {
      const openId = await auth.ensureLogin()
      await order.cancelOrder(this.data.orderId, { openId })

      app._syncAuth()

      wx.showToast({
        title: getCancelSuccessTitle(this.data.cancelKind),
        icon: 'success'
      })

      if (this.data.fromPlaza) {
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 400)
        return
      }

      await this.loadOrder()
    } catch (error) {
      wx.showToast({
        title: CANCEL_ERROR_MESSAGES[error.code] || error.message || '取消失败',
        icon: 'none'
      })
      await this.loadOrder()
    } finally {
      this.setData({ submitting: false })
    }
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

      app._syncAuth()

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
