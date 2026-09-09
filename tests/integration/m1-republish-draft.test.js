/**
 * M1 — 再来一单预填草稿
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadModule } = require('../helpers/setup')

const {
  buildRepublishDraft,
  parseNoteForRepublish,
  findPointIndex,
  applyRepublishDraft,
  setRepublishDraft,
  consumeRepublishDraft
} = loadModule('modules/order/republish-draft.js')
const { DEFAULT_POINTS } = loadModule('modules/order/constants/points.js')

describe('再来一单 — buildRepublishDraft', () => {
  it('M3 单优先用 pointId', () => {
    const draft = buildRepublishDraft(
      { from: '米奇大街', to: '西门', count: 2, note: '携带大件行李' },
      { fromPointId: 'poi-01', toPointId: 'poi-08', passengerCount: 2, note: '携带大件行李' }
    )
    assert.equal(draft.fromPointId, 'poi-01')
    assert.equal(draft.toPointId, 'poi-08')
    assert.equal(draft.passengerCount, 2)
    assert.equal(draft.note, '携带大件行李')
  })
})

describe('再来一单 — 备注解析', () => {
  it('标签 + 补充说明', () => {
    const parsed = parseNoteForRepublish('携带大件行李 · 准时出发')
    assert.equal(parsed.selectedNoteMap['携带大件行李'], true)
    assert.equal(parsed.supplementNote, '准时出发')
  })

  it('纯补充说明', () => {
    const parsed = parseNoteForRepublish('准时出发')
    assert.deepEqual(parsed.selectedNoteMap, {})
    assert.equal(parsed.supplementNote, '准时出发')
  })
})

describe('再来一单 — POI 匹配', () => {
  it('按 pointId 匹配', () => {
    assert.equal(findPointIndex(DEFAULT_POINTS, { pointId: 'poi-08' }), 7)
  })

  it('按名称模糊匹配', () => {
    assert.equal(findPointIndex(DEFAULT_POINTS, { name: '西门' }), 7)
  })
})

describe('再来一单 — applyRepublishDraft', () => {
  it('预填起终点、人数、备注', () => {
    const applied = applyRepublishDraft(
      {
        fromPointId: 'poi-01',
        toPointId: 'poi-08',
        passengerCount: 3,
        note: '需要安静 · 备注一句'
      },
      DEFAULT_POINTS,
      [1, 2, 3, 4, 5]
    )
    assert.equal(applied.fromPointId, 'poi-01')
    assert.equal(applied.toPointId, 'poi-08')
    assert.equal(applied.passengerCount, 3)
    assert.equal(applied.selectedNoteMap['需要安静'], true)
    assert.equal(applied.supplementNote, '备注一句')
  })
})

describe('再来一单 — 一次性草稿', () => {
  it('consume 后清空', () => {
    setRepublishDraft({ fromName: '西门', toName: '米奇大街', passengerCount: 1, note: '' })
    const first = consumeRepublishDraft()
    assert.ok(first)
    assert.equal(consumeRepublishDraft(), null)
  })
})
