/**
 * Tab「消息」通知标题 — 统一「状态主句 · 补充信息」
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

function orderContext(order, pointNameById, extra) {
  return {
    routeLabel: formatRoute(order, pointNameById),
    scheduleLabel: formatSchedule(order),
    ...(extra || {})
  }
}

/** 司机接单 → 乘车人 Tab */
function titleAcceptedPassenger(order, pointNameById, driverName) {
  const ctx = orderContext(order, pointNameById, { driverName: driverName || '司机' })
  return joinParts([
    '订单已进入待出发',
    `${ctx.driverName}已接单`,
    ctx.routeLabel,
    ctx.scheduleLabel
  ])
}

/** 乘客取消（已有司机）→ 车主 Tab */
function titlePassengerCancelOwner(order, pointNameById) {
  const ctx = orderContext(order, pointNameById)
  return joinParts(['订单已关闭', '乘客已取消', ctx.routeLabel, ctx.scheduleLabel])
}

/** 司机取消接单 → 乘车人 Tab */
function titleDriverCancelPassenger(order, pointNameById) {
  const ctx = orderContext(order, pointNameById)
  return joinParts(['订单重新匹配中', '司机已取消匹配', ctx.routeLabel, ctx.scheduleLabel])
}

/** 行程自动开始 → 双方 Tab */
function titleTripStarted(order, pointNameById) {
  const ctx = orderContext(order, pointNameById)
  return joinParts(['行程已开始', ctx.routeLabel, ctx.scheduleLabel])
}

/** 行程自动完成 → 双方 Tab */
function titleTripCompleted(order, pointNameById) {
  const ctx = orderContext(order, pointNameById)
  return joinParts(['行程已完成', ctx.routeLabel, ctx.scheduleLabel])
}

/** 匹配过期 → 乘车人 Tab */
function titleMatchExpiredPassenger(order, pointNameById) {
  const ctx = orderContext(order, pointNameById)
  return joinParts(['订单已关闭', '匹配超时', ctx.routeLabel, ctx.scheduleLabel])
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
