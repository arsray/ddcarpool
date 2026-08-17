/**
 * M3 — order 模块公共 API
 * 契约：docs/MODULE_CONTRACTS.md · DATA_MODEL v2
 */

const { DEFAULT_POINTS } = require('./constants/points')
const { computeMatchScore } = require('./match')
const {
  ORDER_STATUS,
  STATUS_LABELS,
  FILTER_BUCKETS
} = require('./constants/status')

function notImplemented(name) {
  const err = new Error(`${name} not implemented — M3 owner`)
  err.code = 'NOT_IMPLEMENTED'
  throw err
}

async function listOpenOrders(_options) {
  notImplemented('listOpenOrders')
}

async function createOrder(_input) {
  notImplemented('createOrder')
}

async function acceptOrder(_orderId, _driver) {
  notImplemented('acceptOrder')
}

async function cancelOrder(_orderId, _options) {
  notImplemented('cancelOrder')
}

async function expireStaleOrders() {
  notImplemented('expireStaleOrders')
}

async function startTrip(_orderId, _actorOpenId) {
  notImplemented('startTrip')
}

async function getOrderById(_orderId) {
  notImplemented('getOrderById')
}

async function listOrdersForUser(_openId, _filters) {
  notImplemented('listOrdersForUser')
}

async function listConfiguredRoutes() {
  const { DEFAULT_CONFIGURED_ROUTES } = require('./constants/routes')
  return DEFAULT_CONFIGURED_ROUTES
}

async function completeOrder(_orderId, _actorOpenId) {
  notImplemented('completeOrder')
}

async function listPoints() {
  return DEFAULT_POINTS
}

function formatRoute(fromPointId, toPointId, points) {
  const list = points || DEFAULT_POINTS
  const from = list.find((p) => p.pointId === fromPointId)
  const to = list.find((p) => p.pointId === toPointId)
  const fromName = from ? from.name : '未知起点'
  const toName = to ? to.name : '未知终点'
  return `${fromName} → ${toName}`
}

module.exports = {
  listOpenOrders,
  createOrder,
  acceptOrder,
  cancelOrder,
  expireStaleOrders,
  startTrip,
  completeOrder,
  getOrderById,
  listOrdersForUser,
  listPoints,
  listConfiguredRoutes,
  formatRoute,
  computeMatchScore,
  ORDER_STATUS,
  STATUS_LABELS,
  FILTER_BUCKETS
}
