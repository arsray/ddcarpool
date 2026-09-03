const app = getApp()
const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const config = require('../../config/index')
const { toHistoryItem, toOwnerHistoryItem } = require('../../modules/order/history-bridge')
const { STATUS_CLASS } = require('../../modules/auth/order-status')
const { buildDetailView } = require('../../modules/auth/order-display')
const { DANGER_ACTIONS } = require('../../modules/auth/order-actions')
const {
  resolveCancelAction,
  getCancelModalConfig,
  getCancelSuccessTitle,
  CANCEL_ERROR_MESSAGES
} = order

function previewToast(title) {
  wx.showToast({ title: `${title}（预览）`, icon: 'none' })
}

Page({
  data: {
    order: null,
    orderId: '',
    statusClass: '',
    sourceTag: '',
    statusSubline: '',
    sections: [],
    actions: [],
    role: 'owner',
    submitting: false
  },

  onLoad(options) {
    this.setData({ role: options.role || 'owner', orderId: options.id })
  },

  async onShow() {
    if (!auth.requireLogin()) return
    await this.loadDetail()
  },

  async loadDetail() {
    let orderItem
    if (config.useCloud) {
      try {
        const cloudOrder = await order.getOrderById(this.data.orderId)
        orderItem = this.data.role === 'owner'
          ? toOwnerHistoryItem(cloudOrder)
          : toHistoryItem(cloudOrder)
      } catch (error) {
        wx.showToast({ title: '订单加载失败', icon: 'none' })
        return
      }
    } else {
      const list = this.data.role === 'owner'
        ? app.globalData.historyOwner
        : app.globalData.historyPassenger
      orderItem = (list || []).find((i) => i.id === this.data.orderId)
    }
    if (!orderItem) {
      wx.showToast({ title: '未找到订单', icon: 'none' })
      return
    }
    const detail = buildDetailView(orderItem, this.data.role)
    const actions = auth.statusActions(orderItem, this.data.role).map((label) => ({
      label,
      danger: DANGER_ACTIONS.includes(label),
      success: label === '进入 Chat'
    }))
    wx.setNavigationBarTitle({ title: detail.navTitle })
    this.setData({
      order: orderItem,
      statusClass: STATUS_CLASS[orderItem.status],
      sourceTag: detail.sourceTag,
      statusSubline: detail.statusSubline,
      sections: detail.sections,
      actions
    })
  },

  onAction(e) {
    const action = e.currentTarget.dataset.action
    const { order: orderItem, role } = this.data

    if (action === '再来一单' || action === '再发一单') {
      wx.showToast({ title: '跳转发布页（待开发）', icon: 'none' })
      return
    }
    if (action === '进入 Chat') {
      wx.navigateTo({ url: `/pages/chat/chat?orderId=${orderItem.m3OrderId || orderItem.id}` })
      return
    }
    if (action === '查看匹配推荐') {
      wx.showToast({ title: '匹配推荐占位，待 M3 集成', icon: 'none' })
      return
    }
    if (action === '编辑') {
      wx.showToast({ title: '跳转编辑页（待联调）', icon: 'none' })
      return
    }

    if (action === '停止匹配') {
      wx.showModal({
        title: '停止匹配',
        content: '该车主订单将被关闭。',
        confirmText: '停止匹配',
        cancelText: '返回',
        confirmColor: '#dc2626',
        success: (res) => {
          if (res.confirm) previewToast('已停止匹配')
        }
      })
      return
    }

    if (action === '取消搭车单' || action === '取消匹配') {
      this.handleCancelOrder(orderItem)
      return
    }

    previewToast(action)
  },

  async handleCancelOrder(orderItem) {
    if (this.data.submitting) return

    const orderId = orderItem.m3OrderId || orderItem.id
    let m3Order = null
    let openId = ''

    try {
      openId = await auth.ensureLogin()
      m3Order = await order.getOrderById(orderId)
    } catch (error) {
      wx.showToast({ title: '加载订单失败', icon: 'none' })
      return
    }

    if (!m3Order) {
      wx.showToast({ title: '订单不存在', icon: 'none' })
      return
    }

    const cancelKind = resolveCancelAction(m3Order, openId)
    if (!cancelKind) {
      wx.showToast({ title: '当前不可取消', icon: 'none' })
      return
    }

    const modal = getCancelModalConfig(cancelKind)
    if (!modal) return

    wx.showModal({
      ...modal,
      success: (res) => {
        if (res.confirm) this.submitCancel(orderId, cancelKind)
      }
    })
  },

  async submitCancel(orderId, cancelKind) {
    this.setData({ submitting: true })
    try {
      const openId = await auth.ensureLogin()
      await order.cancelOrder(orderId, { openId })

      app._syncAuth()

      wx.showToast({
        title: getCancelSuccessTitle(cancelKind),
        icon: 'success'
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 400)
    } catch (error) {
      wx.showToast({
        title: CANCEL_ERROR_MESSAGES[error.code] || error.message || '取消失败',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
