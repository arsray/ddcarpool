/**
 * POI 模糊搜索词库与单字符拉丁/数字匹配
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { filterPoints, findPointByQuery } = require('../../miniprogram/modules/order/point-search')
const { DEFAULT_POINTS } = require('../../miniprogram/modules/order/constants/points')

describe('POI 搜索 · 单字母/数字', () => {
  it('「6」命中 603 / 615 / 604 等', () => {
    const ids = filterPoints(DEFAULT_POINTS, '6').map((p) => p.pointId)
    assert.ok(ids.includes('poi-02'))
    assert.ok(ids.includes('poi-04'))
    assert.ok(ids.includes('poi-07'))
  })

  it('「x」命中西门与项目行政楼', () => {
    const ids = filterPoints(DEFAULT_POINTS, 'x').map((p) => p.pointId)
    assert.ok(ids.includes('poi-06'))
    assert.ok(ids.includes('poi-08'))
  })

  it('「td」前缀命中团队大楼', () => {
    const match = findPointByQuery(DEFAULT_POINTS, 'td')
    assert.equal(match && match.pointId, 'poi-03')
  })
})

describe('POI 搜索 · 更新词库', () => {
  it('比斯特可用奥特莱斯', () => {
    const ids = filterPoints(DEFAULT_POINTS, '奥特').map((p) => p.pointId)
    assert.deepEqual(ids, ['poi-14'])
  })

  it('羽托邦可用羽毛球', () => {
    const match = findPointByQuery(DEFAULT_POINTS, '羽毛球')
    assert.equal(match.pointId, 'poi-15')
  })
})
