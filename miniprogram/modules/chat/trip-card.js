/**
 * M4 — 聊天页行程卡片 ViewModel
 */

const { STATUS_LABELS } = require('../order/constants/status')
const { formatHistoryTimeLabel } = require('../order/time-slots')

function buildTripCardViewModel(order, formatRoute) {
  if (!order) return null

  const routeLabel = typeof formatRoute === 'function'
    ? formatRoute(order.fromPointId, order.toPointId)
    : `${order.fromPointId || ''} → ${order.toPointId || ''}`

  return {
    routeLabel,
    timeLabel: formatHistoryTimeLabel(order),
    statusLabel: STATUS_LABELS[order.status] || order.status || '',
    passengerLine: `${order.passengerCount || 1} 人`,
    note: String(order.note || '').trim()
  }
}

module.exports = {
  buildTripCardViewModel
}
