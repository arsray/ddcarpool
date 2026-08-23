/**
 * 订单状态机 — 合法迁移校验
 */

const { ORDER_STATUS, CLOSE_REASON } = require('./constants/status')

const ALLOWED_TRANSITIONS = {
  [ORDER_STATUS.MATCHING]: new Set([
    ORDER_STATUS.PENDING_DEPARTURE,
    ORDER_STATUS.CLOSED
  ]),
  [ORDER_STATUS.PENDING_DEPARTURE]: new Set([
    ORDER_STATUS.IN_PROGRESS,
    ORDER_STATUS.COMPLETED,
    ORDER_STATUS.CLOSED
  ]),
  [ORDER_STATUS.IN_PROGRESS]: new Set([ORDER_STATUS.COMPLETED]),
  [ORDER_STATUS.COMPLETED]: new Set([]),
  [ORDER_STATUS.CLOSED]: new Set([])
}

function canTransition(from, to) {
  return ALLOWED_TRANSITIONS[from] ? ALLOWED_TRANSITIONS[from].has(to) : false
}

function targetStatusForAction(status, action) {
  const map = {
    matching: {
      accept: ORDER_STATUS.PENDING_DEPARTURE,
      cancel: ORDER_STATUS.CLOSED,
      expire: ORDER_STATUS.CLOSED
    },
    pending_departure: {
      cancel: ORDER_STATUS.CLOSED,
      start: ORDER_STATUS.IN_PROGRESS,
      complete: ORDER_STATUS.COMPLETED
    },
    in_progress: {
      complete: ORDER_STATUS.COMPLETED
    }
  }
  return map[status] && map[status][action] ? map[status][action] : null
}

module.exports = {
  canTransition,
  targetStatusForAction,
  CLOSE_REASON
}
