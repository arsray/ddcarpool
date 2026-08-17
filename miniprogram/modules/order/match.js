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
  computeMatchScore
}
