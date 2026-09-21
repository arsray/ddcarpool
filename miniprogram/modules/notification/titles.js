/**
 * Tab「消息」通知标题 — 触发事件一句（路线/时段见订单详情）
 * 云函数侧副本：cloudfunctions/order/common/notification-titles.js
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

/** 司机接单 → 乘车人 Tab */
function titleAcceptedPassenger(_order, _pointNameById, _driverName) {
  return '司机已接单'
}

/** 乘客取消（已有司机）→ 车主 Tab */
function titlePassengerCancelOwner(_order, _pointNameById) {
  return '乘客已取消'
}

/** 司机取消接单 → 乘车人 Tab */
function titleDriverCancelPassenger(_order, _pointNameById) {
  return '司机已取消接单'
}

/** 行程自动开始 → 双方 Tab */
function titleTripStarted(_order, _pointNameById) {
  return '行程自动开始'
}

/** 行程自动完成 → 双方 Tab */
function titleTripCompleted(_order, _pointNameById) {
  return '行程自动完成'
}

/** 匹配过期 → 乘车人 Tab */
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
