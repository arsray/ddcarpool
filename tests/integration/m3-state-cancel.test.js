/**
 * M3 — 状态机合法迁移 + cancel-flow 权限矩阵
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadModule, withOrderModule, ALICE, BOB, buildCreateInput } = require('../helpers/setup')

const { ORDER_STATUS } = loadModule('modules/order/constants/status.js')
const { canTransition, targetStatusForAction } = loadModule('modules/order/status-machine.js')
const {
  resolveCancelAction,
  getCancelModalConfig,
  getCancelSuccessTitle,
  CANCEL_KIND
} = loadModule('modules/order/cancel-flow.js')

describe('M3 状态机 — 合法迁移', () => {
  const allowed = [
    [ORDER_STATUS.MATCHING, ORDER_STATUS.PENDING_DEPARTURE],
    [ORDER_STATUS.MATCHING, ORDER_STATUS.CLOSED],
    [ORDER_STATUS.PENDING_DEPARTURE, ORDER_STATUS.IN_PROGRESS],
    [ORDER_STATUS.PENDING_DEPARTURE, ORDER_STATUS.COMPLETED],
    [ORDER_STATUS.PENDING_DEPARTURE, ORDER_STATUS.CLOSED],
    [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.COMPLETED]
  ]

  for (const [from, to] of allowed) {
    it(`${from} → ${to}`, () => {
      assert.equal(canTransition(from, to), true)
    })
  }

  const forbidden = [
    [ORDER_STATUS.MATCHING, ORDER_STATUS.COMPLETED],
    [ORDER_STATUS.COMPLETED, ORDER_STATUS.MATCHING],
    [ORDER_STATUS.CLOSED, ORDER_STATUS.MATCHING],
    [ORDER_STATUS.IN_PROGRESS, ORDER_STATUS.MATCHING]
  ]

  for (const [from, to] of forbidden) {
    it(`禁止 ${from} → ${to}`, () => {
      assert.equal(canTransition(from, to), false)
    })
  }
})

describe('M3 状态机 — action 映射', () => {
  it('matching + accept → pending_departure', () => {
    assert.equal(
      targetStatusForAction(ORDER_STATUS.MATCHING, 'accept'),
      ORDER_STATUS.PENDING_DEPARTURE
    )
  })

  it('pending_departure + complete → completed（Mock 短路）', () => {
    assert.equal(
      targetStatusForAction(ORDER_STATUS.PENDING_DEPARTURE, 'complete'),
      ORDER_STATUS.COMPLETED
    )
  })

  it('in_progress 无 cancel action', () => {
    assert.equal(targetStatusForAction(ORDER_STATUS.IN_PROGRESS, 'cancel'), null)
  })
})

describe('M3 cancel-flow — resolveCancelAction 矩阵', () => {
  const baseOrder = {
    passengerOpenId: ALICE.openId,
    driverOpenId: BOB.openId
  }

  const matrix = [
    {
      name: '乘客 · 匹配中 → passenger_cancel',
      order: { ...baseOrder, status: ORDER_STATUS.MATCHING, driverOpenId: '' },
      actor: ALICE.openId,
      expected: CANCEL_KIND.PASSENGER_CANCEL
    },
    {
      name: '乘客 · 待出发 → passenger_cancel',
      order: { ...baseOrder, status: ORDER_STATUS.PENDING_DEPARTURE },
      actor: ALICE.openId,
      expected: CANCEL_KIND.PASSENGER_CANCEL
    },
    {
      name: '司机 · 待出发 → driver_release',
      order: { ...baseOrder, status: ORDER_STATUS.PENDING_DEPARTURE },
      actor: BOB.openId,
      expected: CANCEL_KIND.DRIVER_RELEASE
    },
    {
      name: '乘客 · 行程中 → null',
      order: { ...baseOrder, status: ORDER_STATUS.IN_PROGRESS },
      actor: ALICE.openId,
      expected: null
    },
    {
      name: '司机 · 匹配中（未接单）→ null',
      order: { ...baseOrder, status: ORDER_STATUS.MATCHING, driverOpenId: '' },
      actor: BOB.openId,
      expected: null
    },
    {
      name: '无关用户 → null',
      order: { ...baseOrder, status: ORDER_STATUS.PENDING_DEPARTURE },
      actor: 'mock_other_user',
      expected: null
    }
  ]

  for (const row of matrix) {
    it(row.name, () => {
      assert.equal(resolveCancelAction(row.order, row.actor), row.expected)
    })
  }
})

describe('M3 cancel-flow — 弹窗与成功文案', () => {
  it('乘客取消弹窗', () => {
    const modal = getCancelModalConfig(CANCEL_KIND.PASSENGER_CANCEL)
    assert.equal(modal.title, '取消搭车单')
    assert.match(modal.content, /不再参与匹配/)
  })

  it('司机取消匹配弹窗（2A）', () => {
    const modal = getCancelModalConfig(CANCEL_KIND.DRIVER_RELEASE)
    assert.equal(modal.title, '取消匹配')
    assert.match(modal.content, /取消与对方的同行匹配/)
  })

  it('成功 Toast 文案', () => {
    assert.equal(getCancelSuccessTitle(CANCEL_KIND.PASSENGER_CANCEL), '已取消搭车单')
    assert.equal(getCancelSuccessTitle(CANCEL_KIND.DRIVER_RELEASE), '已取消匹配')
  })
})

describe('M3 cancelOrder API — 每个状态实际操作结果', () => {
  it('乘客 matching / pending → closed', async () => {
    await withOrderModule(null, async ({ order }) => {
      for (const status of [ORDER_STATUS.MATCHING, ORDER_STATUS.PENDING_DEPARTURE]) {
        const created = await order.createOrder(buildCreateInput())
        if (status === ORDER_STATUS.PENDING_DEPARTURE) {
          await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
        }
        await order.cancelOrder(created._id, { openId: ALICE.openId })
        const result = await order.getOrderById(created._id)
        assert.equal(result.status, ORDER_STATUS.CLOSED, status)
      }
    })
  })

  it('司机 pending → matching', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      await order.cancelOrder(created._id, { openId: BOB.openId })
      const result = await order.getOrderById(created._id)
      assert.equal(result.status, ORDER_STATUS.MATCHING)
      assert.equal(result.driverOpenId, '')
    })
  })

  it('行程中取消 → TRIP_IN_PROGRESS_NO_CANCEL', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      const orders = (await order.getOrderById(created._id))
      orders.status = ORDER_STATUS.IN_PROGRESS
      global.wx.setStorageSync('m3_orders_v1', [orders])

      await assert.rejects(
        () => order.cancelOrder(created._id, { openId: ALICE.openId }),
        (err) => err.code === 'TRIP_IN_PROGRESS_NO_CANCEL'
      )
    })
  })

  it('已完成不可再取消', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      await order.completeOrder(created._id, BOB.openId)

      await assert.rejects(
        () => order.cancelOrder(created._id, { openId: ALICE.openId }),
        (err) => err.code === 'INVALID_STATUS'
      )
    })
  })
})
