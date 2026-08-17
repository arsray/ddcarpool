/**
 * 兼容入口 — 逐步迁移至 constants/points.js、constants/status.js
 */
const { DEFAULT_POINTS } = require('./constants/points')
const {
  ORDER_STATUS,
  STATUS_LABELS,
  CLOSE_REASON,
  FILTER_BUCKETS
} = require('./constants/status')

module.exports = {
  DEFAULT_POINTS,
  ORDER_STATUS,
  STATUS_LABELS,
  CLOSE_REASON,
  FILTER_BUCKETS
}
