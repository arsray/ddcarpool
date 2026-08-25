/**
 * 取消订单 — 共享能力判定与弹窗文案（detail / history-detail 共用）
 */

const { ORDER_STATUS } = require('./constants/status')

const CANCEL_KIND = {
  PASSENGER_CANCEL: 'passenger_cancel',
  DRIVER_RELEASE: 'driver_release'
}

const CANCEL_ERROR_MESSAGES = {
  ORDER_NOT_FOUND: '订单不存在',
  INVALID_STATUS: '订单当前不可取消',
  FORBIDDEN: '无权操作此订单',
  NOT_LOGGED_IN: '请先登录',
  TRIP_IN_PROGRESS_NO_CANCEL: '行程中不可取消'
}

function resolveCancelAction(order, actorOpenId) {
  if (!order || !actorOpenId) return null
  if (order.status === ORDER_STATUS.IN_PROGRESS) return null

  const isPassenger = order.passengerOpenId === actorOpenId
  const isDriver = order.driverOpenId === actorOpenId

  if (
    isPassenger &&
    [ORDER_STATUS.MATCHING, ORDER_STATUS.PENDING_DEPARTURE].includes(order.status)
  ) {
    return CANCEL_KIND.PASSENGER_CANCEL
  }

  if (isDriver && order.status === ORDER_STATUS.PENDING_DEPARTURE) {
    return CANCEL_KIND.DRIVER_RELEASE
  }

  return null
}

function getCancelModalConfig(kind) {
  if (kind === CANCEL_KIND.PASSENGER_CANCEL) {
    return {
      title: '取消搭车单',
      content: '取消后将不再参与匹配。',
      confirmText: '取消搭车单',
      cancelText: '返回',
      confirmColor: '#dc2626'
    }
  }
  if (kind === CANCEL_KIND.DRIVER_RELEASE) {
    return {
      title: '取消匹配',
      content: '将取消与对方的同行匹配。',
      confirmText: '取消匹配',
      cancelText: '返回',
      confirmColor: '#dc2626'
    }
  }
  return null
}

function getCancelSuccessTitle(kind) {
  if (kind === CANCEL_KIND.DRIVER_RELEASE) return '已取消匹配'
  return '已取消搭车单'
}

function getCancelButtonLabel(kind) {
  if (kind === CANCEL_KIND.DRIVER_RELEASE) return '取消匹配'
  return '取消搭车单'
}

module.exports = {
  CANCEL_KIND,
  CANCEL_ERROR_MESSAGES,
  resolveCancelAction,
  getCancelModalConfig,
  getCancelSuccessTitle,
  getCancelButtonLabel
}
