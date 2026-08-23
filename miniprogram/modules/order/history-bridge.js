/**
 * M3 订单 ↔ M1 历史列表 UI 格式
 */

const { STATUS_LABELS } = require('./constants/status')
const { DEFAULT_POINTS } = require('./constants/points')
const { formatHistoryTimeLabel, parseDepartTime } = require('./time-slots')

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function resolvePointName(pointId) {
  const point = DEFAULT_POINTS.find((item) => item.pointId === pointId)
  return point ? point.name : pointId
}

function formatDateLabel(date) {
  return `${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`
}

function formatTimeLabel(date) {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function toHistoryItem(order) {
  const departDate = parseDepartTime(order.departTime)
  const sortAt = departDate ? departDate.getTime() : Date.now()
  const closedReasonMap = {
    cancelled_by_passenger: '已取消',
    cancelled_by_driver: '司机已取消',
    expired: '已过期'
  }

  const item = {
    id: order._id,
    from: resolvePointName(order.fromPointId),
    to: resolvePointName(order.toPointId),
    dateLabel: departDate ? formatDateLabel(departDate) : '',
    timeLabel: formatHistoryTimeLabel(order),
    sortAt,
    status: STATUS_LABELS[order.status] || order.status,
    count: order.passengerCount || 1,
    note: order.note || '',
    m3OrderId: order._id
  }

  if (order.status === 'closed') {
    item.closedReason = closedReasonMap[order.closeReason] || '已关闭'
  }

  if (order.driverName && ['pending_departure', 'in_progress', 'completed'].includes(order.status)) {
    item.partnerName = order.driverName
  }

  return item
}

/** 司机「接单」产生的车主订单（M1 historyOwner 格式） */
function toOwnerHistoryItem(order) {
  const base = toHistoryItem(order)
  return {
    ...base,
    count: order.passengerCount || 1,
    partnerName: order.passengerName || '乘客',
    createdFrom: 'accept',
    hasPublishTrip: false
  }
}

function mergeHistoryItems(userItems, seedItems) {
  const seen = new Set((userItems || []).map((item) => item.id))
  const merged = (userItems || []).slice()
  ;(seedItems || []).forEach((item) => {
    if (!seen.has(item.id)) merged.push(item)
  })
  return merged
}

module.exports = {
  toHistoryItem,
  toOwnerHistoryItem,
  mergeHistoryItems,
  parseDepartTime,
  formatDateLabel,
  formatTimeLabel
}
