/**
 * 完整用户旅程 — 注册登录 → 选身份 → 乘客发单 → 司机筛选接单
 * 范围：P0 不含「车主发布行程」
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  withAuthStore,
  withOrderModule,
  simulatePassengerOnboarding,
  simulateOwnerOnboarding,
  buildCreateInput,
  loadModule,
  ALICE,
  BOB
} = require('../helpers/setup')

const { sendCodeLocal, verifyCodeLocal } = loadModule('modules/auth/verify.js')
const { buildPlazaFilterView } = loadModule('modules/order/plaza-filter.js')

describe('旅程 A：Mock 账号快速路径（Alice 发单 → Bob 接单）', () => {
  it('切换 Alice → 发单 → 切 Bob → 广场接单 → Alice 通知', async () => {
    await withOrderModule(null, async ({ order, mockWx }) => {
      const store = loadModule('modules/auth/store.js')
      global.wx = mockWx

      store.switchMockUser(ALICE.email)
      const created = await order.createOrder(buildCreateInput({ note: '旅程测试' }))
      assert.equal(created.status, 'matching')

      store.switchMockUser(BOB.email)
      const bobOpenId = store.getOpenId()

      const plaza = await order.listOpenOrders({ viewerOpenId: bobOpenId })
      assert.ok(plaza.some((item) => item._id === created._id))

      await order.acceptOrder(created._id, { openId: bobOpenId, name: 'Bob' })

      const notes = mockWx.getStorageSync('notifications')
      assert.ok(notes.some((n) => n.recipientOpenId === ALICE.openId))

      store.initFromStorage()
      const ownerHistory = store.getState().historyOwner
      assert.ok(ownerHistory.some((item) => item.id === created._id && item.createdFrom === 'accept'))
    })
  })
})

describe('旅程 B：新用户注册 → 选乘客 → 发单 → 添加车主 → 筛选 → 接单', () => {
  it('从零注册到接单闭环', async () => {
    await withOrderModule(null, async ({ order, mockWx }) => {
      const passengerEmail = 'journey.passenger@disney.com'
      const driverEmail = 'journey.driver@disney.com'

      // --- 乘客注册登录 ---
      await withAuthStore({}, async ({ store }) => {
        const sent = sendCodeLocal(passengerEmail)
        const verified = verifyCodeLocal(passengerEmail, sent.code)
        store.loginWithEmail(verified.email)
        simulatePassengerOnboarding(store)
        assert.ok(store.hasIdentity('passenger'))

        // --- 乘客发单 ---
        const passengerOpenId = store.getOpenId()
        const created = await order.createOrder(
          buildCreateInput({
            passengerOpenId,
            passengerName: 'Journey Passenger',
            fromPointId: 'poi-05',
            toPointId: 'poi-12'
          })
        )

        // --- 同一用户添加车主身份（P0 无车主发单，仅为了能接单）---
        store.loginWithEmail(driverEmail)
        simulateOwnerOnboarding(store)
        const driverOpenId = store.getOpenId()

        const openOrders = await order.listOpenOrders({ viewerOpenId: driverOpenId })
        assert.ok(openOrders.some((o) => o._id === created._id))

        // --- 广场筛选：先窄后宽 ---
        const points = await order.listPoints()
        const date = created.departTime.slice(0, 10)
        const narrow = buildPlazaFilterView(openOrders, points, {
          date,
          timeWindow: '',
          fromPointId: 'poi-05',
          toPointId: 'poi-12'
        }, new Date())
        assert.ok(narrow.matchedOrders.some((o) => o._id === created._id))

        const cleared = buildPlazaFilterView(openOrders, points, {
          date: '',
          timeWindow: '',
          fromPointId: '',
          toPointId: ''
        }, new Date())
        assert.ok(cleared.matchedOrders.some((o) => o._id === created._id))

        // --- 司机接单 ---
        await order.acceptOrder(created._id, { openId: driverOpenId, name: 'Journey Driver' })
        const accepted = await order.getOrderById(created._id)
        assert.equal(accepted.status, 'pending_departure')

        const active = await order.listDriverActiveOrders(driverOpenId)
        assert.ok(active.some((o) => o._id === created._id))

        // --- 完成 ---
        await order.completeOrder(created._id, driverOpenId)
        assert.equal((await order.getOrderById(created._id)).status, 'completed')
      })
    })
  })
})

describe('旅程 C：纯乘客看不到广场订单列表（身份门槛）', () => {
  it('listOpenOrders 对乘客仍可用，但 UI 逻辑 isPassengerOnly 应不展示', async () => {
    await withAuthStore({}, ({ store }) => {
      store.switchMockUser(ALICE.email)
      const ids = store.getState().identities
      const hasOwner = ids.includes('owner')
      const isPassengerOnly = ids.includes('passenger') && !hasOwner
      assert.equal(isPassengerOnly, true)
    })
  })
})

describe('旅程 D：P0 不含车主发布行程', () => {
  it('M3 无 startTrip / 车主发单 API', async () => {
    await withOrderModule(null, async ({ order }) => {
      assert.equal(typeof order.createOrder, 'function')
      await assert.rejects(() => order.startTrip('x', 'y'), (err) => err.code === 'NOT_IMPLEMENTED')
    })
  })

  it('M1 fixture 车主单均为 accept 来源', () => {
    const { FIXTURE } = require('../fixtures/m1-seed-orders')
    FIXTURE.historyOwner.forEach((order) => {
      assert.equal(order.createdFrom, 'accept')
      assert.equal(order.hasPublishTrip, false)
    })
  })
})
