const app = getApp()
const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const chat = require('../../modules/chat/index')
const { formatDateLabel } = require('../../modules/order/history-bridge')
const { formatHistoryTimeLabel, parseDepartTime } = require('../../modules/order/time-slots')
const { buildDetailViewModel } = require('./detail-view-model')
const { buildDriverCard } = require('../../modules/order/driver-vehicle')
const {
  resolveCancelAction,
  getCancelModalConfig,
  getCancelSuccessTitle,
  CANCEL_ERROR_MESSAGES,
  CANCEL_KIND
} = order

const HEADER_WATERMARKS = {
  matching: '/assets/detail-watermark-mickey.png',
  pending_departure: '/assets/detail-watermark-stitch.png',
  in_progress: '/assets/detail-watermark-stitch.png',
  completed: '/assets/detail-watermark-woody.png',
  closed: '/assets/detail-watermark-pluto.png'
}

function resolveHeaderWatermark(status) {
  return HEADER_WATERMARKS[status] || HEADER_WATERMARKS.matching
}

Page({
  data: {
    loading: true,
    submitting: false,
    order: null,
    routeLabel: '',
    statusLabel: '',
    roleLabel: '',
    statusHint: '',
    actions: [],
    actionGroups: { primary: [], secondary: [], danger: [] },
    actionRows: [],
    timeWindowLabel: '',
    dateWeekLabel: '',
    fromName: '',
    toName: '',
    passengerLine: '',
    showDriverCard: false,
    driverCard: null,
    isPassenger: false,
    isAssignedDriver: false,
    canAccept: false,
    canComplete: false,
    canCancel: false,
    cancelKind: '',
    fromPlaza: false,
    fromHistory: false,
    headerWatermark: HEADER_WATERMARKS.matching
  },

  onLoad(options) {
    this.setData({
      orderId: options.orderId || options.id || '',
      fromPlaza: options.from === 'plaza',
      fromHistory: options.from === 'history'
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
      const isPassenger = item.viewerRole === 'passenger' ||
        (!item.viewerRole && item.passengerOpenId === openId)
      const isAssignedDriver = item.viewerRole === 'driver' ||
        (!item.viewerRole && item.driverOpenId === openId)
      const hasOwnerIdentity = app.hasIdentity('owner')
      const canAccept =
        item.status === order.ORDER_STATUS.MATCHING &&
        !isPassenger &&
        hasOwnerIdentity &&
        !item.driverOpenId &&
        item.viewerRole !== 'passenger'
      const canComplete =
        isAssignedDriver &&
        (item.status === order.ORDER_STATUS.PENDING_DEPARTURE ||
          item.status === order.ORDER_STATUS.IN_PROGRESS)
      const canStart =
        isAssignedDriver &&
        item.status === order.ORDER_STATUS.PENDING_DEPARTURE
      const canChat = chat.canEnterChat(item, openId)
      const cancelKind = resolveCancelAction(item, openId, { isPassenger, isAssignedDriver })
      const routeLabel = order.formatRoute(item.fromPointId, item.toPointId)
      const routeParts = routeLabel.split(' → ')
      const departDate = parseDepartTime(item.departTime)

      const viewModel = buildDetailViewModel({
        status: item.status,
        isPassenger,
        isAssignedDriver,
        canAccept,
        canStart,
        canComplete,
        canChat,
        cancelKind,
        fromPlaza: this.data.fromPlaza,
        fallbackStatusLabel: order.STATUS_LABELS[item.status] || item.status
      })
      const driverCard = buildDriverCard(item, isPassenger)

      this.setData({
        loading: false,
        order: item,
        routeLabel,
        statusLabel: viewModel.statusLabel,
        roleLabel: viewModel.roleLabel,
        statusHint: viewModel.statusHint,
        actions: viewModel.actions,
        actionGroups: viewModel.actionGroups,
        actionRows: viewModel.actionRows,
        timeWindowLabel: formatHistoryTimeLabel(item),
        dateWeekLabel: departDate ? formatDateLabel(departDate) : '',
        fromName: routeParts[0] || '',
        toName: routeParts[1] || '',
        passengerLine: `${item.passengerName || '乘客'} · ${item.passengerCount || 1}人`,
        showDriverCard: driverCard.show,
        driverCard: driverCard.show ? driverCard : null,
        isPassenger,
        isAssignedDriver,
        canAccept,
        canComplete,
        canCancel: !!cancelKind,
        cancelKind: cancelKind || '',
        headerWatermark: resolveHeaderWatermark(item.status)
      })
    } catch (error) {
      this.setData({ loading: false, order: null, actions: [] })
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  onAction(event) {
    const action = event.currentTarget.dataset.action
    if (action === 'cancel_passenger' || action === 'cancel_driver') {
      this.onCancel()
      return
    }
    const handlers = {
      accept: () => this.onAccept(),
      start: () => this.onStart(),
      complete: () => this.onComplete(),
      cancel_passenger: () => this.onCancel(),
      cancel_driver: () => this.onCancel(),
      chat: () => this.goChat(),
      history: () => this.goHistory(),
      plaza: () => this.backToPlaza()
    }
    const handler = handlers[action]
    if (handler) handler()
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
        name: (profile && profile.nickName) || app.globalData.userInfo.displayName || '司机',
        vehicle: app.globalData.vehicle
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
    if (this.data.fromHistory) {
      wx.navigateBack()
      return
    }
    const role = this.data.isPassenger ? 'passenger' : 'owner'
    wx.navigateTo({ url: `/pages/history/history?role=${role}` })
  },

  goChat() {
    wx.navigateTo({ url: `/pages/chat/chat?orderId=${this.data.orderId}` })
  },

  async onStart() {
    if (this.data.submitting) return
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

  resolveCancelKind() {
    const { order, isPassenger, isAssignedDriver, cancelKind } = this.data
    if (cancelKind) return cancelKind
    if (!order || !order.status) return null
    if (isPassenger && ['matching', 'pending_departure'].includes(order.status)) {
      return CANCEL_KIND.PASSENGER_CANCEL
    }
    if (isAssignedDriver && order.status === 'pending_departure') {
      return CANCEL_KIND.DRIVER_RELEASE
    }
    return resolveCancelAction(order, app.globalData.openId, { isPassenger, isAssignedDriver })
  },

  onCancel() {
    if (this.data.submitting) return

    let cancelKind = this.resolveCancelKind()
    if (!cancelKind && this.data.isPassenger) {
      cancelKind = CANCEL_KIND.PASSENGER_CANCEL
    } else if (!cancelKind && this.data.isAssignedDriver) {
      cancelKind = CANCEL_KIND.DRIVER_RELEASE
    }

    const modal = getCancelModalConfig(cancelKind) || (
      cancelKind === CANCEL_KIND.DRIVER_RELEASE
        ? {
          title: '取消匹配',
          content: '将取消与对方的同行匹配。',
          confirmText: '取消匹配',
          cancelText: '返回'
        }
        : {
          title: '取消搭车单',
          content: '取消后将不再参与匹配。',
          confirmText: '确认取消',
          cancelText: '返回'
        }
    )

    wx.showModal({
      title: modal.title,
      content: modal.content,
      confirmText: modal.confirmText,
      cancelText: modal.cancelText,
      showCancel: true,
      success: (res) => {
        if (res.confirm) this.submitCancel(cancelKind)
      }
    })
  },

  async submitCancel(cancelKind) {
    const kind = cancelKind || this.data.cancelKind
    this.setData({ submitting: true })
    try {
      const openId = await auth.ensureLogin()
      await order.cancelOrder(this.data.orderId, { openId })

      app._syncAuth()

      wx.showToast({
        title: getCancelSuccessTitle(kind),
        icon: 'success'
      })

      if (this.data.fromPlaza) {
        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 400)
        return
      }

      if (this.data.fromHistory) {
        setTimeout(() => {
          wx.navigateBack()
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
      confirmText: '订单完成',
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
