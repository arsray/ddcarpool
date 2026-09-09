/**
 * P0 主路径冒烟 — Alice / Bob 端到端
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { withOrderModule, ALICE, BOB, buildCreateInput } = require('../helpers/setup')

describe('P0 Mock 主路径（Alice / Bob）', () => {
  it('Alice 发单 → Bob 广场可见 → 接单 → Alice 收到通知', async () => {
    await withOrderModule(null, async ({ order, mockWx }) => {
      const created = await order.createOrder(buildCreateInput({ note: '集成测试' }))
      assert.equal(created.status, order.ORDER_STATUS.MATCHING)

      const bobPlaza = await order.listOpenOrders({ viewerOpenId: BOB.openId })
      assert.ok(bobPlaza.some((item) => item._id === created._id))

      const alicePlaza = await order.listOpenOrders({ viewerOpenId: ALICE.openId })
      assert.ok(!alicePlaza.some((item) => item._id === created._id))

      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      const afterAccept = await order.getOrderById(created._id)
      assert.equal(afterAccept.status, order.ORDER_STATUS.PENDING_DEPARTURE)

      const notifications = mockWx.getStorageSync('notifications')
      assert.ok(
        notifications.some(
          (n) => n.recipientOpenId === ALICE.openId && String(n.title).includes('已被接单')
        )
      )
    })
  })

  it('Bob 完成订单 → completed', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      await order.completeOrder(created._id, BOB.openId)
      const done = await order.getOrderById(created._id)
      assert.equal(done.status, order.ORDER_STATUS.COMPLETED)
    })
  })

  it('Alice 取消匹配中 → closed', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.cancelOrder(created._id, { openId: ALICE.openId })
      const closed = await order.getOrderById(created._id)
      assert.equal(closed.status, order.ORDER_STATUS.CLOSED)
      assert.equal(closed.closeReason, 'cancelled_by_passenger')
    })
  })

  it('Bob 取消待出发 → 回 matching', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      await order.cancelOrder(created._id, { openId: BOB.openId })
      const released = await order.getOrderById(created._id)
      assert.equal(released.status, order.ORDER_STATUS.MATCHING)
      const plaza = await order.listOpenOrders({ viewerOpenId: BOB.openId })
      assert.ok(plaza.some((item) => item._id === created._id))
    })
  })

  it('Bob 不能接自己的单', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(
        buildCreateInput({ passengerOpenId: BOB.openId, passengerName: BOB.name })
      )
      await assert.rejects(
        () => order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name }),
        (err) => err.code === 'SELF_ACCEPT'
      )
    })
  })
})
