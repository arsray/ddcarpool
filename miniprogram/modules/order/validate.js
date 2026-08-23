/**
 * createOrder 入参校验 — PRD P0-01 / P0-04 / P0-05
 */

const { getPointById } = require('./constants/points')
const {
  parseDepartTime,
  getDepartWindowEnd,
  isAlignedSlot,
  windowsOverlap
} = require('./time-slots')

const MAX_NOTE_LENGTH = 100
const MAX_DAYS_AHEAD = 7
const MIN_PASSENGER_COUNT = 1
const MAX_PASSENGER_COUNT = 10

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function getPublishWindow(now) {
  const base = now || new Date()
  const min = startOfDay(base)
  const maxAnchor = new Date(base)
  maxAnchor.setDate(maxAnchor.getDate() + MAX_DAYS_AHEAD)
  return { min, max: endOfDay(maxAnchor) }
}

function validationError(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

function validateCreateOrderInput(input, existingOrders) {
  if (!input || typeof input !== 'object') {
    throw validationError('INVALID_INPUT', '发布信息无效')
  }

  const fromPointId = (input.fromPointId || '').trim()
  const toPointId = (input.toPointId || '').trim()
  const departTime = (input.departTime || '').trim()
  const departTimeEnd = (input.departTimeEnd || '').trim()
  const passengerOpenId = (input.passengerOpenId || '').trim()
  const passengerCount = Number(input.passengerCount)
  const note = input.note != null ? String(input.note).trim() : ''

  if (!passengerOpenId) {
    throw validationError('NOT_LOGGED_IN', '请先登录')
  }

  if (!getPointById(fromPointId) || !getPointById(toPointId)) {
    throw validationError('INVALID_POI', '请选择有效的上下车地点')
  }

  if (fromPointId === toPointId) {
    throw validationError('INVALID_POI', '起点和终点不能相同')
  }

  const departDate = parseDepartTime(departTime)
  if (!departDate) {
    throw validationError('INVALID_DEPART_TIME', '请选择有效的出发时间')
  }

  const startClock = departTime.slice(11, 16)
  if (!isAlignedSlot(startClock) || !departTimeEnd) {
    throw validationError('INVALID_DEPART_TIME', '请选择 15 分钟出发时间窗')
  }

  const { min, max } = getPublishWindow(new Date())
  if (departDate < min || departDate > max) {
    throw validationError('INVALID_DEPART_TIME', '仅可发布今天起 7 日内的订单')
  }

  const windowEnd = getDepartWindowEnd({ departTime, departTimeEnd })
  if (!windowEnd || windowEnd.getTime() <= Date.now()) {
    throw validationError('INVALID_DEPART_TIME', '出发时间窗不能早于当前时间')
  }

  if (
    !Number.isInteger(passengerCount) ||
    passengerCount < MIN_PASSENGER_COUNT ||
    passengerCount > MAX_PASSENGER_COUNT
  ) {
    throw validationError('INVALID_PASSENGER_COUNT', '出行人数需在 1–10 人')
  }

  if (note.length > MAX_NOTE_LENGTH) {
    throw validationError('INVALID_NOTE', `备注不超过 ${MAX_NOTE_LENGTH} 字`)
  }

  const candidate = { departTime, departTimeEnd }
  const activeOrders = (existingOrders || []).filter(
    (order) =>
      order.passengerOpenId === passengerOpenId &&
      ['matching', 'pending_departure', 'in_progress'].includes(order.status)
  )

  const hasOverlap = activeOrders.some((order) => windowsOverlap(candidate, order))
  if (hasOverlap) {
    throw validationError('OVERLAPPING_ORDER', '该时段已有进行中的订单')
  }

  return {
    fromPointId,
    toPointId,
    departTime,
    departTimeEnd,
    passengerCount,
    note,
    passengerOpenId,
    passengerName: (input.passengerName || '').trim()
  }
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function buildDatePickerOptions(now) {
  const base = now || new Date()
  const start = startOfDay(base)
  const values = []
  const labels = []
  for (let i = 0; i <= MAX_DAYS_AHEAD; i += 1) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    values.push(`${y}-${m}-${day}`)
    labels.push(`${Number(m)}月${Number(day)}日 ${WEEKDAYS[d.getDay()]}`)
  }
  return { values, labels }
}

function buildDatePickerRange(now) {
  return buildDatePickerOptions(now).values
}

module.exports = {
  MAX_NOTE_LENGTH,
  MAX_DAYS_AHEAD,
  MIN_PASSENGER_COUNT,
  MAX_PASSENGER_COUNT,
  parseDepartTime,
  getPublishWindow,
  validateCreateOrderInput,
  buildDatePickerRange,
  buildDatePickerOptions
}
