/**
 * M3 — 广场筛选：日期 / 时间 / 起终点 / 清除
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadModule, withOrderModule, ALICE, BOB, futureDepartWindow } = require('../helpers/setup')

const {
  buildDefaultPlazaFilters,
  buildPlazaFilterView,
  hasActivePlazaFilters,
  matchesPlazaFilters
} = loadModule('modules/order/plaza-filter.js')

function makePlazaOrder(id, fromPointId, toPointId, daysAhead, hour, minute = 0) {
  const slot = futureDepartWindow(daysAhead, hour)
  const endH = hour
  const endM = minute + 15
  return {
    _id: id,
    fromPointId,
    toPointId,
    departTime: slot.departTime.replace(/10:00$/, `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`),
    departTimeEnd: `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`,
    status: 'matching',
    passengerOpenId: ALICE.openId
  }
}

describe('M3 广场默认筛选', () => {
  it('首次进入默认今天 + 下一个 15 分钟时段', () => {
    const now = new Date('2026-08-28T09:07:00')
    const filters = buildDefaultPlazaFilters(now)
    assert.ok(filters.date)
    assert.ok(filters.timeWindow)
    assert.equal(filters.fromPointId, '')
    assert.equal(filters.toPointId, '')
  })

  it('清除后四项均为「全部」', () => {
    const empty = { date: '', timeWindow: '', fromPointId: '', toPointId: '' }
    assert.equal(hasActivePlazaFilters(empty), false)
  })
})

describe('M3 广场筛选匹配', () => {
  const now = new Date('2026-08-28T09:00:00')
  const orders = [
    makePlazaOrder('o1', 'poi-01', 'poi-08', 1, 10, 0),
    makePlazaOrder('o2', 'poi-02', 'poi-10', 1, 11, 0),
    makePlazaOrder('o3', 'poi-01', 'poi-10', 2, 10, 0)
  ]
  const points = loadModule('modules/order/constants/points.js').DEFAULT_POINTS

  it('按起点 POI 筛选', () => {
    const view = buildPlazaFilterView(orders, points, {
      date: '',
      timeWindow: '',
      fromPointId: 'poi-01',
      toPointId: ''
    }, now)
    assert.ok(view.matchedOrders.some((o) => o._id === 'o1'))
    assert.ok(view.matchedOrders.some((o) => o._id === 'o3'))
    assert.ok(!view.matchedOrders.some((o) => o._id === 'o2'))
  })

  it('有筛选条件时分「符合条件 / 其他」两区', () => {
    const view = buildPlazaFilterView(orders, points, {
      date: orders[0].departTime.slice(0, 10),
      timeWindow: '',
      fromPointId: '',
      toPointId: ''
    }, now)
    assert.ok(view.hasActiveFilters)
    assert.ok(view.matchedOrders.length >= 1)
    assert.ok(view.otherOrders.length >= 1)
  })

  it('matchesPlazaFilters 日期 + 时间窗同时命中', () => {
    const target = orders[0]
    const date = target.departTime.slice(0, 10)
    const timeLabel = '10:00-10:15'
    assert.equal(
      matchesPlazaFilters(target, { date, timeWindow: timeLabel, fromPointId: '', toPointId: '' }),
      true
    )
  })
})

describe('M3 广场 listOpenOrders + 筛选联动', () => {
  it('司机看不到自己发的单；筛选后仍可从 other 区看到', async () => {
    await withOrderModule(null, async ({ order }) => {
      const slot = futureDepartWindow(1, 14)
      await order.createOrder({
        fromPointId: 'poi-03',
        toPointId: 'poi-09',
        departTime: slot.departTime.replace('10:00', '14:00'),
        departTimeEnd: '14:15',
        passengerCount: 1,
        passengerOpenId: ALICE.openId,
        passengerName: ALICE.name
      })

      const all = await order.listOpenOrders({ viewerOpenId: BOB.openId })
      assert.ok(all.length >= 1)

      const points = await order.listPoints()
      const view = buildPlazaFilterView(all, points, {
        date: '',
        timeWindow: '',
        fromPointId: 'poi-99',
        toPointId: ''
      })
      assert.equal(view.matchedOrders.length, 0)
      assert.ok(view.otherOrders.length >= 1)
    })
  })
})
