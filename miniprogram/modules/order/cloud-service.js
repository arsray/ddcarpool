const { callFunction } = require('../../utils/cloud')
const { STATUS_LABELS } = require('./constants/status')
const { DEFAULT_POINTS } = require('./constants/points')
const { DEFAULT_CONFIGURED_ROUTES } = require('./constants/routes')
const { formatDepartTimeDisplay } = require('./time-slots')
const { computeMatchScore } = require('./match')

let pointCache = null
let routeCache = null

function routeLabel(fromPointId, toPointId, points) {
  const list = points || pointCache || DEFAULT_POINTS
  const from = list.find((item) => item.pointId === fromPointId)
  const to = list.find((item) => item.pointId === toPointId)
  return `${from ? from.name : '未知起点'} → ${to ? to.name : '未知终点'}`
}

function enrich(order, options) {
  if (!order) return null
  return {
    ...order,
    routeLabel: routeLabel(order.fromPointId, order.toPointId),
    statusLabel: STATUS_LABELS[order.status] || order.status,
    departTimeLabel: formatDepartTimeDisplay(order),
    matchScore: options && options.computeMatchScore
      ? options.computeMatchScore(order, options.context || {}, routeCache || undefined)
      : computeMatchScore(order, options && options.context ? options.context : {}, routeCache || undefined)
  }
}

async function invoke(action, data) {
  return callFunction('order', { action, ...(data || {}) })
}

async function listOpenOrders(options) {
  const list = await invoke('listOpen')
  return (list || []).map((item) => enrich(item, options))
}

async function listDriverActiveOrders(_openId, options) {
  const list = await invoke('listDriverActive')
  return (list || []).map((item) => enrich(item, options))
}

async function listOrdersForUser(_openId, filters) {
  const list = await invoke('listForUser', {
    role: filters && filters.role === 'driver' ? 'driver' : 'passenger'
  })
  return (list || []).map((item) => enrich(item, filters))
}

async function getOrderById(orderId) {
  return enrich(await invoke('getById', { orderId }))
}

async function createOrder(input) {
  return enrich(await invoke('create', {
    fromPointId: input.fromPointId,
    toPointId: input.toPointId,
    departTime: input.departTime,
    departTimeEnd: input.departTimeEnd,
    passengerCount: input.passengerCount,
    note: input.note
  }))
}

async function acceptOrder(orderId) {
  return enrich(await invoke('accept', { orderId }))
}

async function cancelOrder(orderId) {
  return enrich(await invoke('cancel', { orderId }))
}

async function startTrip(orderId) {
  return enrich(await invoke('start', { orderId }))
}

async function completeOrder(orderId) {
  return enrich(await invoke('complete', { orderId }))
}

async function expireStaleOrders() {
  return invoke('expireStale')
}

async function listPoints() {
  const list = await invoke('listPoints')
  pointCache = list && list.length ? list : DEFAULT_POINTS
  return pointCache
}

async function listConfiguredRoutes() {
  const list = await invoke('listRoutes')
  routeCache = list && list.length ? list : DEFAULT_CONFIGURED_ROUTES
  return routeCache
}

module.exports = {
  listOpenOrders,
  listDriverActiveOrders,
  listOrdersForUser,
  getOrderById,
  createOrder,
  acceptOrder,
  cancelOrder,
  startTrip,
  completeOrder,
  expireStaleOrders,
  listPoints,
  listConfiguredRoutes,
  routeLabel
}
