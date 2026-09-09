/**
 * 订单详情 · 订单进度时间线
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadModule } = require('../helpers/setup')
const { buildOrderProgress, formatProgressTime } = loadModule('modules/order/order-progress.js')
const { ORDER_STATUS } = loadModule('modules/order/constants/status.js')

describe('order progress timeline', () => {
  it('formats timestamp as YYYY-MM-DD HH:mm', () => {
    const label = formatProgressTime('2026-09-09T08:45:00+08:00')
    assert.match(label, /^2026-09-09 08:45$/)
  })

  it('matching shows publish step only', () => {
    const steps = buildOrderProgress({
      status: ORDER_STATUS.MATCHING,
      createdAt: '2026-09-08T14:32:00+08:00'
    })
    assert.equal(steps.length, 1)
    assert.equal(steps[0].label, '发布订单')
    assert.equal(steps[0].isCurrent, true)
  })

  it('in_progress hides future complete step', () => {
    const steps = buildOrderProgress({
      status: ORDER_STATUS.IN_PROGRESS,
      createdAt: '2026-09-08T14:32:00+08:00',
      matchedAt: '2026-09-08T15:10:00+08:00',
      startedAt: '2026-09-09T08:45:00+08:00'
    })
    assert.deepEqual(
      steps.map((step) => step.label),
      ['发布订单', '车主接单', '行程开始']
    )
    assert.equal(steps[2].isCurrent, true)
  })

  it('completed shows all four steps', () => {
    const steps = buildOrderProgress({
      status: ORDER_STATUS.COMPLETED,
      createdAt: '2026-09-04T10:32:00+08:00',
      matchedAt: '2026-09-04T11:05:00+08:00',
      startedAt: '2026-09-04T11:45:00+08:00',
      completedAt: '2026-09-04T12:30:00+08:00'
    })
    assert.equal(steps.length, 4)
    assert.equal(steps[3].label, '行程完成')
    assert.equal(steps[3].isCurrent, true)
  })

  it('closed uses close step instead of complete', () => {
    const steps = buildOrderProgress({
      status: ORDER_STATUS.CLOSED,
      createdAt: '2026-09-08T14:32:00+08:00',
      matchedAt: '2026-09-08T15:10:00+08:00',
      closedAt: '2026-09-08T16:20:00+08:00'
    })
    assert.deepEqual(
      steps.map((step) => step.label),
      ['发布订单', '车主接单', '订单关闭']
    )
    assert.equal(steps[2].tone, 'muted')
    assert.equal(steps[2].isCurrent, true)
  })

  it('closed before accept shows publish and close only', () => {
    const steps = buildOrderProgress({
      status: ORDER_STATUS.CLOSED,
      createdAt: '2026-09-08T14:32:00+08:00',
      closedAt: '2026-09-08T14:50:00+08:00'
    })
    assert.deepEqual(
      steps.map((step) => step.label),
      ['发布订单', '订单关闭']
    )
  })
})
