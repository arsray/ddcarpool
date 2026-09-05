/**
 * 订单本地存储 — Mock / 无云环境阶段
 * 接入云开发后在此替换为 orders 集合读写
 */

const { ORDER_STATUS, CLOSE_REASON, STATUS_LABELS } = require('./constants/status')
const { DEFAULT_POINTS } = require('./constants/points')
const { validateCreateOrderInput } = require('./validate')
const { parseDepartTime, getDepartWindowEnd, formatDepartTimeDisplay, formatHistoryTimeLabel } = require('./time-slots')
const { comparePlazaOrders } = require('./plaza-sort')
const { snapshotDriverVehicle } = require('./driver-vehicle')

function getHistoryBridge() {
  return require('./history-bridge')
}

function resolveStatusAction(status, action) {
  const { targetStatusForAction, canTransition } = require('./status-machine')
  const nextStatus = targetStatusForAction(status, action)
  if (!nextStatus || !canTransition(status, nextStatus)) {
    return null
  }
  return nextStatus
}

function isSeedOrderId(orderId) {
  return String(orderId || '').startsWith('seed_')
}

function isSeedRenamedClone(orderId) {
  return /^seed_.+_n[a-z0-9]+$/.test(String(orderId || ''))
}

function formatRoute(fromPointId, toPointId) {
  const from = DEFAULT_POINTS.find((point) => point.pointId === fromPointId)
  const to = DEFAULT_POINTS.find((point) => point.pointId === toPointId)
  const fromName = from ? from.name : '未知起点'
  const toName = to ? to.name : '未知终点'
  return `${fromName} → ${toName}`
}

const STORAGE_KEY = 'm3_orders_v1'

function readAllOrders() {
  return wx.getStorageSync(STORAGE_KEY) || []
}

function writeAllOrders(orders) {
  wx.setStorageSync(STORAGE_KEY, orders)
}

function generateOrderId() {
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function expireStaleOrdersInMemory(orders) {
  const now = Date.now()
  let changed = false

  const withoutClones = orders.filter((order) => {
    if (!isSeedRenamedClone(order._id)) return true
    changed = true
    return false
  })

  const next = withoutClones.map((order) => {
    if (order.status !== ORDER_STATUS.MATCHING) return order
    const windowEnd = getDepartWindowEnd(order)
    if (!windowEnd || windowEnd.getTime() > now) return order
    changed = true
    return {
      ...order,
      status: ORDER_STATUS.CLOSED,
      closeReason: CLOSE_REASON.EXPIRED,
      closedAt: nowIso(),
      updatedAt: nowIso()
    }
  })

  if (changed) writeAllOrders(next)
  return next
}

function saveOrder(order) {
  const orders = readAllOrders()
  const index = orders.findIndex((item) => item._id === order._id)
  if (index >= 0) {
    orders[index] = order
  } else {
    orders.unshift(order)
  }
  writeAllOrders(orders)
  return order
}

function createOrder(input) {
  const orders = expireStaleOrdersInMemory(readAllOrders())
  const validated = validateCreateOrderInput(input, orders)
  const timestamp = nowIso()

  const order = {
    _id: generateOrderId(),
    fromPointId: validated.fromPointId,
    toPointId: validated.toPointId,
    departTime: validated.departTime,
    departTimeEnd: validated.departTimeEnd,
    passengerCount: validated.passengerCount,
    note: validated.note,
    status: ORDER_STATUS.MATCHING,
    passengerOpenId: validated.passengerOpenId,
    passengerName: validated.passengerName || '乘客',
    driverOpenId: '',
    driverName: '',
    createdAt: timestamp,
    updatedAt: timestamp
  }

  saveOrder(order)
  return order
}

function getOrderById(orderId) {
  const orders = expireStaleOrdersInMemory(readAllOrders())
  return orders.find((item) => item._id === orderId) || null
}

function listOpenOrders(options) {
  const orders = expireStaleOrdersInMemory(readAllOrders())
  const now = Date.now()
  const viewerOpenId = options && options.viewerOpenId ? options.viewerOpenId : ''

  return orders
    .filter((order) => {
      if (order.status !== ORDER_STATUS.MATCHING) return false
      const windowEnd = getDepartWindowEnd(order)
      return windowEnd && windowEnd.getTime() > now
    })
    .filter((order) => !viewerOpenId || order.passengerOpenId !== viewerOpenId)
    .sort(comparePlazaOrders)
    .map((order) => enrichListItem(order, options))
}

function listDriverActiveOrders(openId, options) {
  if (!openId) return []

  const activeStatuses = [ORDER_STATUS.PENDING_DEPARTURE, ORDER_STATUS.IN_PROGRESS]
  const orders = expireStaleOrdersInMemory(readAllOrders())

  return orders
    .filter(
      (order) => order.driverOpenId === openId && activeStatuses.includes(order.status)
    )
    .sort(comparePlazaOrders)
    .map((order) => enrichListItem(order, options))
}

function enrichListItem(order, options) {
  const routeLabel = formatRoute(order.fromPointId, order.toPointId)
  let matchScore = 0
  if (options && options.computeMatchScore) {
    matchScore = options.computeMatchScore(order, options.context || {})
  }

  return {
    ...order,
    routeLabel,
    statusLabel: STATUS_LABELS[order.status],
    departTimeLabel: formatDepartTimeDisplay(order),
    matchScore
  }
}

function listOrdersForUser(openId, filters) {
  const orders = expireStaleOrdersInMemory(readAllOrders())
  const role = filters && filters.role ? filters.role : 'passenger'

  if (role === 'passenger') {
    return orders
      .filter((order) => order.passengerOpenId === openId)
      .map((order) => enrichListItem(order, filters))
      .sort((a, b) => parseDepartTime(b.departTime).getTime() - parseDepartTime(a.departTime).getTime())
  }

  return orders
    .filter((order) => order.driverOpenId === openId)
    .map((order) => enrichListItem(order, filters))
    .sort((a, b) => parseDepartTime(b.departTime).getTime() - parseDepartTime(a.departTime).getTime())
}

function buildAcceptNotificationTitle(order) {
  const { formatDateLabel } = getHistoryBridge()
  const departDate = parseDepartTime(order.departTime)
  const dateLabel = departDate ? formatDateLabel(departDate) : (order.departTime || '').slice(0, 10)
  const timeLabel = formatHistoryTimeLabel(order)
  const routeLabel = formatRoute(order.fromPointId, order.toPointId)
  const schedule = [dateLabel, timeLabel].filter(Boolean).join(' ')
  return `${schedule} ${routeLabel} 已被接单`
}

function appendNotification(entry) {
  const list = wx.getStorageSync('notifications') || []
  const now = new Date()
  const timeLabel = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  list.unshift({
    id: `n_${Date.now()}`,
    time: timeLabel,
    read: false,
    ...entry
  })
  wx.setStorageSync('notifications', list)
}

function appendPassengerNotification(order, title) {
  appendNotification({
    title: title || buildAcceptNotificationTitle(order),
    targetType: 'passenger',
    targetId: order._id,
    passengerOpenId: order.passengerOpenId || '',
    recipientOpenId: order.passengerOpenId || ''
  })
}

function buildPassengerCancelNotificationTitle(order) {
  const routeLabel = formatRoute(order.fromPointId, order.toPointId)
  return `乘客已取消搭车单 · ${routeLabel}`
}

function buildDriverReleaseNotificationTitle(order) {
  const routeLabel = formatRoute(order.fromPointId, order.toPointId)
  return `司机已取消匹配 · 您的订单重新匹配中 · ${routeLabel}`
}

function appendDriverNotification(order, title) {
  if (!order.driverOpenId) return
  appendNotification({
    title: title || buildPassengerCancelNotificationTitle(order),
    targetType: 'owner',
    targetId: order._id,
    recipientOpenId: order.driverOpenId
  })
}

function makeError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

function acceptOrder(orderId, driver) {
  const orders = expireStaleOrdersInMemory(readAllOrders())
  const order = orders.find((item) => item._id === orderId)
  const driverOpenId = driver && driver.openId ? driver.openId.trim() : ''
  const driverName = (driver && driver.name ? driver.name : '司机').trim() || '司机'
  const driverVehicle = snapshotDriverVehicle(driver && driver.vehicle)

  if (!order) {
    throw makeError('ORDER_NOT_FOUND', '订单不存在')
  }
  if (!driverOpenId) {
    throw makeError('NOT_LOGGED_IN', '请先登录')
  }
  if (order.passengerOpenId === driverOpenId) {
    throw makeError('SELF_ACCEPT', '不能接自己的单')
  }
  if (order.driverOpenId) {
    throw makeError('ALREADY_ACCEPTED', '订单已被接单')
  }
  if (order.status !== ORDER_STATUS.MATCHING) {
    throw makeError('INVALID_STATUS', '订单当前不可接单')
  }

  const windowEnd = getDepartWindowEnd(order)
  if (!windowEnd || windowEnd.getTime() <= Date.now()) {
    throw makeError('INVALID_STATUS', '订单已过期')
  }

  const nextStatus = resolveStatusAction(order.status, 'accept')
  if (!nextStatus) {
    throw makeError('INVALID_STATUS', '订单当前不可接单')
  }

  const timestamp = nowIso()
  const updated = {
    ...order,
    status: nextStatus,
    driverOpenId,
    driverName,
    driverVehicle: driverVehicle || null,
    matchedAt: timestamp,
    updatedAt: timestamp
  }

  saveOrder(updated)
  appendPassengerNotification(updated)
  return enrichListItem(updated, {})
}

function completeOrder(orderId, actorOpenId) {
  const orders = expireStaleOrdersInMemory(readAllOrders())
  const order = orders.find((item) => item._id === orderId)
  const driverOpenId = (actorOpenId || '').trim()

  if (!order) {
    throw makeError('ORDER_NOT_FOUND', '订单不存在')
  }
  if (!driverOpenId) {
    throw makeError('NOT_LOGGED_IN', '请先登录')
  }
  if (order.driverOpenId !== driverOpenId) {
    throw makeError('FORBIDDEN', '仅接单司机可完成订单')
  }
  if (![ORDER_STATUS.PENDING_DEPARTURE, ORDER_STATUS.IN_PROGRESS].includes(order.status)) {
    throw makeError('INVALID_STATUS', '订单当前不可完成')
  }

  const nextStatus = resolveStatusAction(order.status, 'complete')
  if (!nextStatus) {
    throw makeError('INVALID_STATUS', '订单当前不可完成')
  }

  const timestamp = nowIso()
  const updated = {
    ...order,
    status: nextStatus,
    completedAt: timestamp,
    updatedAt: timestamp
  }

  saveOrder(updated)
  return enrichListItem(updated, {})
}

function cancelOrder(orderId, options) {
  const orders = expireStaleOrdersInMemory(readAllOrders())
  const order = orders.find((item) => item._id === orderId)
  const actorOpenId = options && options.openId ? options.openId.trim() : ''

  if (!order) {
    throw makeError('ORDER_NOT_FOUND', '订单不存在')
  }
  if (!actorOpenId) {
    throw makeError('NOT_LOGGED_IN', '请先登录')
  }
  if (order.status === ORDER_STATUS.IN_PROGRESS) {
    throw makeError('TRIP_IN_PROGRESS_NO_CANCEL', '行程中不可取消')
  }

  const isPassenger = order.passengerOpenId === actorOpenId
  const isDriver = order.driverOpenId === actorOpenId
  if (!isPassenger && !isDriver) {
    throw makeError('FORBIDDEN', '无权操作此订单')
  }

  const timestamp = nowIso()

  if (
    isPassenger &&
    [ORDER_STATUS.MATCHING, ORDER_STATUS.PENDING_DEPARTURE].includes(order.status)
  ) {
    const updated = {
      ...order,
      status: ORDER_STATUS.CLOSED,
      closeReason: CLOSE_REASON.CANCELLED_BY_PASSENGER,
      closedAt: timestamp,
      updatedAt: timestamp
    }
    saveOrder(updated)
    if (order.driverOpenId) {
      appendDriverNotification(updated, buildPassengerCancelNotificationTitle(updated))
    }
    return enrichListItem(updated, {})
  }

  if (isDriver && order.status === ORDER_STATUS.PENDING_DEPARTURE) {
    const { matchedAt, driverVehicle, ...rest } = order
    const updated = {
      ...rest,
      status: ORDER_STATUS.MATCHING,
      driverOpenId: '',
      driverName: '',
      updatedAt: timestamp
    }
    saveOrder(updated)
    appendPassengerNotification(updated, buildDriverReleaseNotificationTitle(updated))
    return enrichListItem(updated, {})
  }

  throw makeError('INVALID_STATUS', '订单当前不可取消')
}

function getPassengerHistoryItems(openId) {
  const { toHistoryItem } = getHistoryBridge()
  return listOrdersForUser(openId, { role: 'passenger' }).map(toHistoryItem)
}

function getDriverHistoryItems(openId) {
  const { toOwnerHistoryItem } = getHistoryBridge()
  return listOrdersForUser(openId, { role: 'driver' }).map(toOwnerHistoryItem)
}

function expireStaleOrders() {
  expireStaleOrdersInMemory(readAllOrders())
  return { expired: true }
}

/** 重置已接单订单为匹配中，便于广场接单流程自测 */
function resetPlazaAcceptedOrders() {
  const orders = readAllOrders()
  let resetCount = 0

  const next = orders
    .filter((order) => !isSeedRenamedClone(order._id))
    .map((order) => {
      if (![ORDER_STATUS.PENDING_DEPARTURE, ORDER_STATUS.IN_PROGRESS].includes(order.status)) {
        return order
      }
      resetCount += 1
      const { matchedAt, ...rest } = order
      return {
        ...rest,
        status: ORDER_STATUS.MATCHING,
        driverOpenId: '',
        driverName: '',
        updatedAt: nowIso()
      }
    })

  writeAllOrders(next)
  return { resetCount }
}

function isLegacyMockHistoryId(orderId) {
  return /^[po]-/.test(String(orderId || ''))
}

/** 清除开发阶段种子单与 M1 假历史订单 */
function purgeDevStageOrders() {
  const existing = readAllOrders()
  const kept = existing.filter(
    (order) => !isSeedOrderId(order._id) && !isSeedRenamedClone(order._id)
  )
  writeAllOrders(kept)

  wx.removeStorageSync('historyOwner')
  wx.removeStorageSync('historyPassenger')

  const notifications = wx.getStorageSync('notifications') || []
  const cleanedNotifications = notifications.filter((item) => {
    const targetId = item.targetId || ''
    return !isLegacyMockHistoryId(targetId) && !isSeedOrderId(targetId)
  })
  wx.setStorageSync('notifications', cleanedNotifications)

  return {
    ordersKept: kept.length,
    ordersRemoved: existing.length - kept.length,
    notificationsKept: cleanedNotifications.length
  }
}

/** 替换广场测试种子订单（仅保留 matching 广场单，不沉淀到历史） */
function replacePlazaSeedOrders(seedOrders) {
  const existing = readAllOrders()
  const nonSeed = existing.filter(
    (order) => !isSeedOrderId(order._id) && !isSeedRenamedClone(order._id)
  )

  writeAllOrders([...(seedOrders || []), ...nonSeed])
  return {
    seeded: (seedOrders || []).length,
    kept: nonSeed.length
  }
}

module.exports = {
  createOrder,
  acceptOrder,
  cancelOrder,
  completeOrder,
  getOrderById,
  listOpenOrders,
  listDriverActiveOrders,
  listOrdersForUser,
  getPassengerHistoryItems,
  getDriverHistoryItems,
  expireStaleOrders,
  replacePlazaSeedOrders,
  resetPlazaAcceptedOrders,
  purgeDevStageOrders
}
