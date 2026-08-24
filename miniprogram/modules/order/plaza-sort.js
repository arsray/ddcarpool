/**
 * 广场订单排序 — 出发时间 → 起点 POI 序号 → 终点 POI 序号 → 创建时间
 */

const { getPointById } = require('./constants/points')
const { parseDepartTime } = require('./time-slots')

const UNKNOWN_POINT_SORT = 9999

function getPointSortOrder(pointId) {
  const point = getPointById(pointId)
  return point ? point.sortOrder : UNKNOWN_POINT_SORT
}

function getDepartTimeMs(order) {
  const date = parseDepartTime(order.departTime)
  return date ? date.getTime() : 0
}

function getCreatedAtMs(order) {
  const parsed = Date.parse(order.createdAt || '')
  return Number.isNaN(parsed) ? 0 : parsed
}

function comparePlazaOrders(a, b) {
  const departDiff = getDepartTimeMs(a) - getDepartTimeMs(b)
  if (departDiff !== 0) return departDiff

  const fromDiff = getPointSortOrder(a.fromPointId) - getPointSortOrder(b.fromPointId)
  if (fromDiff !== 0) return fromDiff

  const toDiff = getPointSortOrder(a.toPointId) - getPointSortOrder(b.toPointId)
  if (toDiff !== 0) return toDiff

  return getCreatedAtMs(a) - getCreatedAtMs(b)
}

module.exports = {
  comparePlazaOrders,
  getPointSortOrder
}
