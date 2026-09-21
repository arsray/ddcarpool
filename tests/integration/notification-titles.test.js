/**
 * Tab「消息」通知标题 — 模板与 Cloud 副本一致性
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { loadModule } = require('../helpers/setup')

const SAMPLE_ORDER = {
  fromPointId: 'poi-01',
  toPointId: 'poi-08',
  departTime: '2026-09-20 10:00',
  departTimeEnd: '10:15'
}

function buildPointMap() {
  const { DEFAULT_POINTS } = loadModule('modules/order/constants/points.js')
  const map = {}
  DEFAULT_POINTS.forEach((point) => {
    map[point.pointId] = point.name
  })
  return map
}

function loadCloudTitles() {
  const abs = path.join(__dirname, '../../cloudfunctions/order/common/notification-titles.js')
  delete require.cache[require.resolve(abs)]
  return require(abs)
}

describe('notification/titles 模板', () => {
  const titles = loadModule('modules/notification/titles.js')
  const pointMap = buildPointMap()

  it('接单 — 乘车人：司机已接单', () => {
    const title = titles.titleAcceptedPassenger(SAMPLE_ORDER, pointMap, 'Bob')
    assert.equal(title, '司机已接单')
  })

  it('乘客取消 — 车主：乘客已取消', () => {
    const title = titles.titlePassengerCancelOwner(SAMPLE_ORDER, pointMap)
    assert.equal(title, '乘客已取消')
  })

  it('司机取消 — 乘车人：司机已取消接单', () => {
    const title = titles.titleDriverCancelPassenger(SAMPLE_ORDER, pointMap)
    assert.equal(title, '司机已取消接单')
  })

  it('自动开始 — 双方：行程自动开始', () => {
    const title = titles.titleTripStarted(SAMPLE_ORDER, pointMap)
    assert.equal(title, '行程自动开始')
  })

  it('自动完成 — 双方：行程自动完成', () => {
    const title = titles.titleTripCompleted(SAMPLE_ORDER, pointMap)
    assert.equal(title, '行程自动完成')
  })

  it('匹配过期 — 乘车人：匹配已超时', () => {
    const title = titles.titleMatchExpiredPassenger(SAMPLE_ORDER, pointMap)
    assert.equal(title, '匹配已超时')
  })
})

describe('notification/titles 与 Cloud 副本一致', () => {
  const mini = loadModule('modules/notification/titles.js')
  const cloud = loadCloudTitles()
  const pointMap = buildPointMap()
  const order = SAMPLE_ORDER

  const cases = [
    ['titleAcceptedPassenger', ['Bob']],
    ['titlePassengerCancelOwner', []],
    ['titleDriverCancelPassenger', []],
    ['titleTripStarted', []],
    ['titleTripCompleted', []],
    ['titleMatchExpiredPassenger', []]
  ]

  for (const [fn, extraArgs] of cases) {
    it(`${fn} 输出与 cloudfunctions/order/common 相同`, () => {
      const a = mini[fn](order, pointMap, ...extraArgs)
      const b = cloud[fn](order, pointMap, ...extraArgs)
      assert.equal(a, b)
    })
  }
})

describe('notification/titles · joinParts', () => {
  const { joinParts } = loadModule('modules/notification/titles.js')

  it('过滤空片段并用 · 连接', () => {
    assert.equal(joinParts(['订单已关闭', '', '匹配超时', null]), '订单已关闭 · 匹配超时')
  })
})
