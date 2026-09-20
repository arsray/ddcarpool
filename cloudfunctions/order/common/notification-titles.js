/**
 * Tab「消息」通知标题 — 与 miniprogram/modules/notification/titles.js 保持一致
 */

function joinParts(parts) {
  return parts.filter((part) => part && String(part).trim()).join(' · ')
}

function formatSchedule(order) {
  if (!order || !order.departTime) return ''
  const date = order.departTime.slice(0, 10)
  const start = order.departTime.slice(11, 16)
  if (order.departTimeEnd) {
    return `${date} ${start}-${order.departTimeEnd}`
  }
  return `${date} ${start}`
}

function formatRoute(order, pointNameById) {
  const map = pointNameById || {}
  const from = map[order.fromPointId] || order.fromPointId || '起点'
  const to = map[order.toPointId] || order.toPointId || '终点'
  return `${from} → ${to}`
}

function titleAcceptedPassenger(_order, _pointNameById, _driverName) {
  return '司机已接单'
}

function titlePassengerCancelOwner(_order, _pointNameById) {
  return '乘客已取消'
}

function titleDriverCancelPassenger(_order, _pointNameById) {
  return '司机已取消接单'
}

function titleTripStarted(_order, _pointNameById) {
  return '行程自动开始'
}

function titleTripCompleted(_order, _pointNameById) {
  return '行程自动完成'
}

function titleMatchExpiredPassenger(_order, _pointNameById) {
  return '匹配已超时'
}

module.exports = {
  joinParts,
  formatSchedule,
  formatRoute,
  titleAcceptedPassenger,
  titlePassengerCancelOwner,
  titleDriverCancelPassenger,
  titleTripStarted,
  titleTripCompleted,
  titleMatchExpiredPassenger
}
