/**
 * M3 — 完整生命周期：发单校验、接单约束、过期、通知
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { withOrderModule, ALICE, BOB, buildCreateInput, futureDepartWindow, loadModule } = require('../helpers/setup')

const { ORDER_STATUS } = loadModule('modules/order/constants/status.js')

describe('M3 createOrder 校验', () => {
  it('缺少登录 openId → NOT_LOGGED_IN', async () => {
    await withOrderModule(null, async ({ order }) => {
      await assert.rejects(
        () => order.createOrder(buildCreateInput({ passengerOpenId: '' })),
        (err) => err.code === 'NOT_LOGGED_IN'
      )
    })
  })

  it('起点终点相同 → INVALID_POI', async () => {
    await withOrderModule(null, async ({ order }) => {
      await assert.rejects(
        () => order.createOrder(buildCreateInput({ fromPointId: 'poi-01', toPointId: 'poi-01' })),
        (err) => err.code === 'INVALID_POI'
      )
    })
  })

  it('备注超过 100 字 → INVALID_NOTE', async () => {
    await withOrderModule(null, async ({ order }) => {
      await assert.rejects(
        () => order.createOrder(buildCreateInput({ note: 'x'.repeat(101) })),
        (err) => err.code === 'INVALID_NOTE'
      )
    })
  })
})

describe('M3 acceptOrder 约束', () => {
  it('重复接单 → ALREADY_ACCEPTED', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      await assert.rejects(
        () => order.acceptOrder(created._id, { openId: 'mock_other_driver', name: 'Other' }),
        (err) => err.code === 'ALREADY_ACCEPTED'
      )
    })
  })

  it('未登录司机 → NOT_LOGGED_IN', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await assert.rejects(
        () => order.acceptOrder(created._id, { openId: '', name: 'Bob' }),
        (err) => err.code === 'NOT_LOGGED_IN'
      )
    })
  })
})

describe('M3 completeOrder 约束', () => {
  it('非接单司机 → FORBIDDEN', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      await assert.rejects(
        () => order.completeOrder(created._id, ALICE.openId),
        (err) => err.code === 'FORBIDDEN'
      )
    })
  })

  it('匹配中不可完成 → FORBIDDEN（尚无接单司机）', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await assert.rejects(
        () => order.completeOrder(created._id, BOB.openId),
        (err) => err.code === 'FORBIDDEN'
      )
    })
  })
})

describe('M3 列表查询', () => {
  it('listDriverActiveOrders 仅 pending / in_progress', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      assert.equal((await order.listDriverActiveOrders(BOB.openId)).length, 0)

      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      const active = await order.listDriverActiveOrders(BOB.openId)
      assert.equal(active.length, 1)
      assert.equal(active[0].status, ORDER_STATUS.PENDING_DEPARTURE)

      await order.completeOrder(created._id, BOB.openId)
      assert.equal((await order.listDriverActiveOrders(BOB.openId)).length, 0)
    })
  })

  it('过期 matching 单不出现在广场', async () => {
    await withOrderModule(null, async ({ order, mockWx }) => {
      const created = await order.createOrder(buildCreateInput())
      const orders = mockWx.getStorageSync('m3_orders_v1')
      const stale = orders.map((item) =>
        item._id === created._id
          ? {
              ...item,
              departTime: '2020-01-01 10:00',
              departTimeEnd: '10:15'
            }
          : item
      )
      mockWx.setStorageSync('m3_orders_v1', stale)

      await order.expireStaleOrders()
      const updated = await order.getOrderById(created._id)
      assert.equal(updated.status, ORDER_STATUS.CLOSED)
      assert.equal(updated.closeReason, 'expired')

      const plaza = await order.listOpenOrders({ viewerOpenId: BOB.openId })
      assert.ok(!plaza.some((item) => item._id === created._id))
    })
  })
})

describe('M3 通知写入', () => {
  it('接单后乘客收到通知', async () => {
    await withOrderModule(null, async ({ order, mockWx }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      const notes = mockWx.getStorageSync('notifications')
      assert.ok(notes.some((n) => n.recipientOpenId === ALICE.openId))
    })
  })

  it('司机取消后乘客收到重新匹配通知', async () => {
    await withOrderModule(null, async ({ order, mockWx }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      mockWx.setStorageSync('notifications', [])
      await order.cancelOrder(created._id, { openId: BOB.openId })
      const notes = mockWx.getStorageSync('notifications')
      assert.ok(notes.some((n) => String(n.title).includes('重新匹配中')))
    })
  })

  it('乘客取消且已有司机时通知司机', async () => {
    await withOrderModule(null, async ({ order, mockWx }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      mockWx.setStorageSync('notifications', [])
      await order.cancelOrder(created._id, { openId: ALICE.openId })
      const notes = mockWx.getStorageSync('notifications')
      assert.ok(notes.some((n) => n.recipientOpenId === BOB.openId))
    })
  })
})

describe('M3 formatRoute / listPoints', () => {
  it('listPoints 返回 15 个 POI', async () => {
    await withOrderModule(null, async ({ order }) => {
      const points = await order.listPoints()
      assert.equal(points.length, 15)
    })
  })

  it('formatRoute 解析 POI 名称', async () => {
    const order = loadModule('modules/order/index.js')
    assert.equal(order.formatRoute('poi-01', 'poi-08'), '米奇大街 → 西门')
  })
})
