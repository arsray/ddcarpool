/**
 * M1 种子单 fixtures — POI 与测试数据对齐（不注入 App 运行时）
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { cloneSeedOrders } = require('../fixtures/m1-seed-orders')
const { loadModule } = require('../helpers/setup')
const { DEFAULT_POINTS } = loadModule('modules/order/constants/points.js')
const { findPointIndex } = loadModule('modules/order/republish-draft.js')

describe('M1 种子单 fixtures — POI 与发单列表一致', () => {
  it('fixture 订单 from/to 能在 DEFAULT_POINTS 中解析', () => {
    const seed = cloneSeedOrders()
    for (const item of seed.historyPassenger) {
      assert.ok(findPointIndex(DEFAULT_POINTS, { pointId: item.fromPointId, name: item.from }) >= 0)
      assert.ok(findPointIndex(DEFAULT_POINTS, { pointId: item.toPointId, name: item.to }) >= 0)
    }
    for (const item of seed.historyOwner) {
      assert.ok(findPointIndex(DEFAULT_POINTS, { pointId: item.fromPointId, name: item.from }) >= 0)
      assert.ok(findPointIndex(DEFAULT_POINTS, { pointId: item.toPointId, name: item.to }) >= 0)
    }
  })
})
