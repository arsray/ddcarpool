/**
 * 顺路度计算 P0 — 基于 configured_routes 点序列
 */

const { DEFAULT_CONFIGURED_ROUTES } = require('./constants/routes')
const { getPointById } = require('./constants/points')

function scoreOnRoute(routePointIds, fromPointId, toPointId) {
  const fromIdx = routePointIds.indexOf(fromPointId)
  const toIdx = routePointIds.indexOf(toPointId)
  if (fromIdx === -1 || toIdx === -1) return 0
  if (fromIdx < toIdx) return 100
  if (fromIdx === toIdx) return 50
  return 0
}

/**
 * 乘客订单起终点是否落在车主路线方向上的途经区间内
 * 例：车主 poi-01 → poi-08，订单 poi-03 → poi-06 视为同向途经
 */
function isOrderAlongDriverRoute(orderFromId, orderToId, driverFromId, driverToId, routes = DEFAULT_CONFIGURED_ROUTES) {
  if (!orderFromId || !orderToId || !driverFromId || !driverToId) return false
  if (orderFromId === orderToId || driverFromId === driverToId) return false

  for (const route of routes) {
    if (route.enabled === false) continue
    const pointIds = route.pointIds
    const driverFromIdx = pointIds.indexOf(driverFromId)
    const driverToIdx = pointIds.indexOf(driverToId)
    if (driverFromIdx === -1 || driverToIdx === -1 || driverFromIdx >= driverToIdx) continue

    const orderFromIdx = pointIds.indexOf(orderFromId)
    const orderToIdx = pointIds.indexOf(orderToId)
    if (orderFromIdx === -1 || orderToIdx === -1 || orderFromIdx >= orderToIdx) continue

    if (orderFromIdx >= driverFromIdx && orderToIdx <= driverToIdx) {
      return true
    }
  }

  return false
}

function matchesPlazaRouteFilter(order, filters, routes = DEFAULT_CONFIGURED_ROUTES) {
  const driverFrom = filters && filters.fromPointId ? filters.fromPointId : ''
  const driverTo = filters && filters.toPointId ? filters.toPointId : ''

  if (driverFrom && driverTo) {
    if (order.fromPointId === driverFrom && order.toPointId === driverTo) return true
    return isOrderAlongDriverRoute(
      order.fromPointId,
      order.toPointId,
      driverFrom,
      driverTo,
      routes
    )
  }

  if (driverFrom) {
    return order.fromPointId === driverFrom
  }

  if (driverTo) {
    return order.toPointId === driverTo
  }

  return true
}

function computeMatchScore(order, _context, routes = DEFAULT_CONFIGURED_ROUTES) {
  if (!getPointById(order.fromPointId) || !getPointById(order.toPointId)) {
    return 0
  }

  let best = 0
  for (const route of routes) {
    if (route.enabled === false) continue
    best = Math.max(best, scoreOnRoute(route.pointIds, order.fromPointId, order.toPointId))
  }

  if (best === 0) return 10
  return best
}

module.exports = {
  computeMatchScore,
  isOrderAlongDriverRoute,
  matchesPlazaRouteFilter
}
