/**
 * 广场订单筛选 — 出发日期 / 时间 / 起点 / 终点
 */

const { formatHistoryTimeLabel, parseDepartTime } = require('./time-slots')
const { matchesPlazaRouteFilter } = require('./match')

const ALL_VALUE = ''
const ALL_LABEL = '全部'
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatFilterDateLabel(dateStr) {
  const date = parseDepartTime(`${dateStr} 08:00`)
  if (!date) return dateStr
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`
}

function getOrderDateStr(order) {
  return (order.departTime || '').slice(0, 10)
}

function getOrderTimeLabel(order) {
  return formatHistoryTimeLabel(order) || ''
}

function collectUniqueDates(orders) {
  const dates = new Set()
  ;(orders || []).forEach((order) => {
    const dateStr = getOrderDateStr(order)
    if (dateStr) dates.add(dateStr)
  })
  return Array.from(dates).sort()
}

function collectUniqueTimes(orders, dateFilter) {
  const times = new Set()
  ;(orders || []).forEach((order) => {
    if (dateFilter && getOrderDateStr(order) !== dateFilter) return
    const timeLabel = getOrderTimeLabel(order)
    if (timeLabel) times.add(timeLabel)
  })
  return Array.from(times).sort()
}

function buildPointOptions(points) {
  const list = points || []
  return {
    labels: [ALL_LABEL, ...list.map((point) => point.name)],
    values: [ALL_VALUE, ...list.map((point) => point.pointId)]
  }
}

function buildDateOptions(orders) {
  const dates = collectUniqueDates(orders)
  return {
    labels: [ALL_LABEL, ...dates.map(formatFilterDateLabel)],
    values: [ALL_VALUE, ...dates]
  }
}

function buildTimeOptions(orders, dateFilter) {
  const times = collectUniqueTimes(orders, dateFilter)
  return {
    labels: [ALL_LABEL, ...times],
    values: [ALL_VALUE, ...times]
  }
}

function indexForValue(values, value) {
  const index = (values || []).indexOf(value)
  return index >= 0 ? index : 0
}

function matchesPlazaFilters(order, filters) {
  if (filters.date && getOrderDateStr(order) !== filters.date) return false
  if (filters.timeWindow && getOrderTimeLabel(order) !== filters.timeWindow) return false
  if (!matchesPlazaRouteFilter(order, filters)) return false
  return true
}

function applyPlazaFilters(orders, filters) {
  return (orders || []).filter((order) => matchesPlazaFilters(order, filters))
}

function normalizeFilters(filters, allOrders) {
  const next = {
    date: filters.date || ALL_VALUE,
    timeWindow: filters.timeWindow || ALL_VALUE,
    fromPointId: filters.fromPointId || ALL_VALUE,
    toPointId: filters.toPointId || ALL_VALUE
  }

  const dateOpts = buildDateOptions(allOrders)
  if (next.date && !dateOpts.values.includes(next.date)) {
    next.date = ALL_VALUE
    next.timeWindow = ALL_VALUE
  }

  const timeOpts = buildTimeOptions(allOrders, next.date)
  if (next.timeWindow && !timeOpts.values.includes(next.timeWindow)) {
    next.timeWindow = ALL_VALUE
  }

  return next
}

function hasActivePlazaFilters(filters) {
  return !!(filters.date || filters.timeWindow || filters.fromPointId || filters.toPointId)
}

function partitionPlazaOrders(allOrders, filters) {
  if (!hasActivePlazaFilters(filters)) {
    return {
      matchedOrders: allOrders || [],
      otherOrders: []
    }
  }

  const matchedOrders = []
  const otherOrders = []
  ;(allOrders || []).forEach((order) => {
    if (matchesPlazaFilters(order, filters)) {
      matchedOrders.push(order)
    } else {
      otherOrders.push(order)
    }
  })

  return { matchedOrders, otherOrders }
}

function buildPlazaFilterView(allOrders, points, filters) {
  const normalized = normalizeFilters(filters || {}, allOrders)
  const dateOpts = buildDateOptions(allOrders)
  const timeOpts = buildTimeOptions(allOrders, normalized.date)
  const fromOpts = buildPointOptions(points)
  const toOpts = buildPointOptions(points)
  const { matchedOrders, otherOrders } = partitionPlazaOrders(allOrders, normalized)

  return {
    filters: normalized,
    filterDateLabels: dateOpts.labels,
    filterDateValues: dateOpts.values,
    filterDateIndex: indexForValue(dateOpts.values, normalized.date),
    filterTimeLabels: timeOpts.labels,
    filterTimeValues: timeOpts.values,
    filterTimeIndex: indexForValue(timeOpts.values, normalized.timeWindow),
    filterFromLabels: fromOpts.labels,
    filterFromValues: fromOpts.values,
    filterFromIndex: indexForValue(fromOpts.values, normalized.fromPointId),
    filterToLabels: toOpts.labels,
    filterToValues: toOpts.values,
    filterToIndex: indexForValue(toOpts.values, normalized.toPointId),
    matchedOrders,
    otherOrders,
    hasActiveFilters: hasActivePlazaFilters(normalized)
  }
}

module.exports = {
  ALL_VALUE,
  ALL_LABEL,
  buildPlazaFilterView,
  applyPlazaFilters,
  partitionPlazaOrders,
  hasActivePlazaFilters,
  matchesPlazaFilters
}
