/**
 * M3 — order 模块
 * 接口契约见 docs/MODULE_CONTRACTS.md
 */

const { DEFAULT_POINTS } = require('./constants')

function notImplemented(name) {
  const err = new Error(`${name} not implemented — M3 owner`)
  err.code = 'NOT_IMPLEMENTED'
  throw err
}

async function listOpenOrders(_filters) {
  notImplemented('listOpenOrders')
}

async function getOrderById(_orderId) {
  notImplemented('getOrderById')
}

async function createOrder(_input) {
  notImplemented('createOrder')
}

async function acceptOrder(_orderId, _accepter) {
  notImplemented('acceptOrder')
}

async function cancelOrder(_orderId) {
  notImplemented('cancelOrder')
}

async function completeOrder(_orderId) {
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
  getOrderById,
  createOrder,
  acceptOrder,
  cancelOrder,
  completeOrder,
  listPoints,
  formatRoute
}
