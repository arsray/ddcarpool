/**
 * M1 ↔ M3 桥接：history-bridge 格式、列表合并、Mock 账号
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadModule, withOrderModule, ALICE, BOB, buildCreateInput } = require('../helpers/setup')

const { toHistoryItem, toOwnerHistoryItem, mergeHistoryItems } = loadModule(
  'modules/order/history-bridge.js'
)
const { STATUS_LABELS, ORDER_STATUS } = loadModule('modules/order/constants/status.js')
const { getMockTestUsers, findMockTestUser, presetToSnapshot } = loadModule(
  'modules/auth/mock-users.js'
)
const { FIXTURE } = require('../fixtures/m1-seed-orders')

describe('M1 Mock 测试账号预设', () => {
  it('Alice / Bob 两个官方账号', () => {
    const users = getMockTestUsers()
    assert.equal(users.length, 2)
    assert.ok(users.some((u) => u.email === ALICE.email))
    assert.ok(users.some((u) => u.email === BOB.email))
  })

  it('Alice 仅乘车人身份', () => {
    const alice = findMockTestUser(ALICE.email)
    assert.deepEqual(alice.identities, ['passenger'])
    assert.equal(alice.userMode, 'passenger')
    assert.ok(alice.preference)
    assert.equal(alice.vehicle, null)
  })

  it('Bob 仅车主身份且含车辆', () => {
    const bob = findMockTestUser(BOB.email)
    assert.deepEqual(bob.identities, ['owner'])
    assert.equal(bob.userMode, 'owner')
    assert.ok(bob.vehicle && bob.vehicle.plate)
  })

  it('presetToSnapshot 可生成独立快照', () => {
    const alice = findMockTestUser(ALICE.email)
    const snap = presetToSnapshot(alice)
    assert.equal(snap.userInfo.email, ALICE.email)
    assert.deepEqual(snap.identities, ['passenger'])
    assert.deepEqual(snap.notifications, [])
  })
})

describe('M3 → M1 history-bridge 格式', () => {
  it('matching 订单转为 M1 列表项（中文状态）', () => {
    const m3Order = {
      _id: 'ord_test_1',
      fromPointId: 'poi-01',
      toPointId: 'poi-08',
      departTime: '2026-08-26 10:00',
      departTimeEnd: '10:15',
      status: ORDER_STATUS.MATCHING,
      passengerCount: 2,
      note: '测试备注'
    }
    const item = toHistoryItem(m3Order)
    assert.equal(item.id, 'ord_test_1')
    assert.equal(item.status, STATUS_LABELS.matching)
    assert.equal(item.from, '米奇大街')
    assert.equal(item.to, '西门')
    assert.equal(item.count, 2)
    assert.equal(item.m3OrderId, 'ord_test_1')
  })

  it('closed 订单带 closedReason', () => {
    const item = toHistoryItem({
      _id: 'ord_closed',
      fromPointId: 'poi-02',
      toPointId: 'poi-03',
      departTime: '2026-08-26 11:00',
      departTimeEnd: '11:15',
      status: ORDER_STATUS.CLOSED,
      closeReason: 'cancelled_by_passenger',
      passengerCount: 1
    })
    assert.equal(item.closedReason, '已取消')
  })

  it('司机历史项标记 createdFrom=accept', () => {
    const item = toOwnerHistoryItem({
      _id: 'ord_accept',
      fromPointId: 'poi-04',
      toPointId: 'poi-05',
      departTime: '2026-08-26 12:00',
      departTimeEnd: '12:15',
      status: ORDER_STATUS.PENDING_DEPARTURE,
      passengerCount: 1,
      passengerName: 'Alice',
      driverName: 'Bob'
    })
    assert.equal(item.createdFrom, 'accept')
    assert.equal(item.partnerName, 'Alice')
    assert.equal(item.hasPublishTrip, false)
  })
})

describe('M1 种子单与 M3 真实单合并', () => {
  it('mergeHistoryItems 去重且 M3 单优先在前', () => {
    const m3Items = [{ id: 'ord_new', sortAt: 999 }]
    const seedItems = FIXTURE.historyPassenger
    const merged = mergeHistoryItems(m3Items, seedItems)
    assert.equal(merged.length, seedItems.length + 1)
    assert.equal(merged[0].id, 'ord_new')
  })

  it('同 id 不重复插入', () => {
    const existing = [{ id: 'p-matching', sortAt: 100 }]
    const seed = FIXTURE.historyPassenger
    const merged = mergeHistoryItems(existing, seed)
    assert.equal(merged.filter((i) => i.id === 'p-matching').length, 1)
  })
})

describe('M3 订单写入后可在 M1 历史格式读取', () => {
  it('Alice 发单 → getPassengerHistoryItems 含中文五态', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      const service = loadModule('modules/order/service.js')
      const items = service.getPassengerHistoryItems(ALICE.openId)
      const found = items.find((i) => i.id === created._id)
      assert.ok(found)
      assert.equal(found.status, '匹配中')
      assert.ok(found.dateLabel)
      assert.ok(found.timeLabel)
    })
  })

  it('Bob 接单 → getDriverHistoryItems 含接单角标字段', async () => {
    await withOrderModule(null, async ({ order }) => {
      const created = await order.createOrder(buildCreateInput())
      await order.acceptOrder(created._id, { openId: BOB.openId, name: BOB.name })
      const service = loadModule('modules/order/service.js')
      const items = service.getDriverHistoryItems(BOB.openId)
      const found = items.find((i) => i.id === created._id)
      assert.ok(found)
      assert.equal(found.status, '待出发')
      assert.equal(found.createdFrom, 'accept')
      assert.equal(found.partnerName, ALICE.name)
    })
  })
})
