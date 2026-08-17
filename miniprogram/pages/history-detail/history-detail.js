const app = getApp()
const auth = require('../../modules/auth/index')
const { STATUS_CLASS } = require('../../modules/auth/order-status')
const { buildDetailView } = require('../../modules/auth/order-display')
const { DANGER_ACTIONS } = require('../../modules/auth/order-actions')

function triggerCancelNotify(order, role) {
  // SECURITY-REVIEW: 通知模块对接入口，后续由通知同事接入真实推送
  console.info('[notify-entry] order_cancel_requested', { orderId: order.id, role })
}

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
    role: 'owner'
  },

  onLoad(options) {
    this.setData({ role: options.role || 'owner', orderId: options.id })
  },

  onShow() {
    if (!auth.requireLogin()) return
    const list = this.data.role === 'owner'
      ? app.globalData.historyOwner
      : app.globalData.historyPassenger
    const order = (list || []).find((i) => i.id === this.data.orderId)
    if (!order) {
      wx.showToast({ title: '未找到订单', icon: 'none' })
      return
    }
    const detail = buildDetailView(order, this.data.role)
    const actions = auth.statusActions(order, this.data.role).map((label) => ({
      label,
      danger: DANGER_ACTIONS.includes(label),
      success: label === '进入 Chat'
    }))
    wx.setNavigationBarTitle({ title: detail.navTitle })
    this.setData({
      order,
      statusClass: STATUS_CLASS[order.status],
      sourceTag: detail.sourceTag,
      statusSubline: detail.statusSubline,
      sections: detail.sections,
      actions
    })
  },

  onAction(e) {
    const action = e.currentTarget.dataset.action
    const { order, role } = this.data

    if (action === '再来一单' || action === '再发一单') {
      wx.showToast({ title: '跳转发布页（待开发）', icon: 'none' })
      return
    }
    if (action === '进入 Chat') {
      wx.showToast({ title: 'Chat 模块占位', icon: 'none' })
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
        cancelText: '取消',
        confirmColor: '#dc2626',
        success: (res) => {
          if (res.confirm) previewToast('已停止匹配')
        }
      })
      return
    }

    if (action === '取消搭车单') {
      wx.showModal({
        title: '取消搭车单',
        content: '取消后将不再参与匹配。',
        confirmText: '取消搭车单',
        cancelText: '取消',
        confirmColor: '#dc2626',
        success: (res) => {
          if (res.confirm) {
            triggerCancelNotify(order, role)
            previewToast('已取消搭车单')
          }
        }
      })
      return
    }

    if (action === '取消匹配') {
      this.handleOwnerCancelMatch(order, role)
      return
    }

    previewToast(action)
  },

  handleOwnerCancelMatch(order, role) {
    const content = order.hasPublishTrip
      ? '将取消与对方的同行匹配。您发布的车主订单将继续匹配。'
      : '将取消与对方的同行匹配。'

    wx.showModal({
      title: '取消匹配',
      content,
      confirmText: '取消匹配',
      cancelText: '取消',
      confirmColor: '#dc2626',
      success: (res) => {
        if (res.confirm) {
          triggerCancelNotify(order, role)
          previewToast(
            order.hasPublishTrip ? '已取消匹配，车主订单继续匹配' : '已取消匹配'
          )
        }
      }
    })
  }
})
