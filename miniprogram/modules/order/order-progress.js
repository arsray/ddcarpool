/**
 * 订单详情 · 订单进度时间线
 */

const { ORDER_STATUS } = require('./constants/status')

function formatProgressTime(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return ''
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function pushStep(steps, label, value, tone = 'active') {
  const time = formatProgressTime(value)
  if (!time) return
  steps.push({ label, time, tone })
}

function markCurrent(steps) {
  if (!steps.length) return steps
  return steps.map((step, index) => ({
    ...step,
    isCurrent: index === steps.length - 1
  }))
}

function buildOrderProgress(order) {
  if (!order) return []

  const steps = []
  pushStep(steps, '发布订单', order.createdAt)

  if (order.status === ORDER_STATUS.CLOSED) {
    pushStep(steps, '车主接单', order.matchedAt)
    pushStep(steps, '订单关闭', order.closedAt, 'muted')
    return markCurrent(steps)
  }

  pushStep(steps, '车主接单', order.matchedAt)
  pushStep(steps, '行程开始', order.startedAt)
  pushStep(steps, '行程完成', order.completedAt)

  return markCurrent(steps)
}

module.exports = {
  formatProgressTime,
  buildOrderProgress
}
