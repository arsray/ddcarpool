/** @file 订单状态枚举 — 与 docs/DATA_MODEL.md v2 一致 */

const ORDER_STATUS = {
  MATCHING: 'matching',
  PENDING_DEPARTURE: 'pending_departure',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CLOSED: 'closed'
}

const STATUS_LABELS = {
  matching: '匹配中',
  pending_departure: '待出发',
  in_progress: '行程中',
  completed: '已完成',
  closed: '已关闭'
}

const CLOSE_REASON = {
  CANCELLED_BY_PASSENGER: 'cancelled_by_passenger',
  CANCELLED_BY_DRIVER: 'cancelled_by_driver',
  EXPIRED: 'expired'
}

const FILTER_BUCKETS = {
  open: ['matching', 'pending_departure', 'in_progress'],
  completed: ['completed'],
  closed: ['closed']
}

function statusInBucket(status, bucket) {
  return FILTER_BUCKETS[bucket].includes(status)
}

module.exports = {
  ORDER_STATUS,
  STATUS_LABELS,
  CLOSE_REASON,
  FILTER_BUCKETS,
  statusInBucket
}
