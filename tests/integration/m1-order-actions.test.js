/**
 * M1 — 每个状态 × 角色 的详情页操作按钮矩阵
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadModule } = require('../helpers/setup')

const { statusActions, buildDetailActions, DANGER_ACTIONS, ACTION_KEY } = loadModule('modules/auth/order-actions.js')
const { STATUS } = loadModule('modules/auth/order-status.js')
const { FIXTURE } = require('../fixtures/m1-seed-orders')

function casesForOrders(orders, role) {
  return orders.map((order) => ({
    id: order.id,
    role,
    status: order.status,
    createdFrom: order.createdFrom || null,
    expected: statusActions(order, role)
  }))
}

describe('M1 订单操作按钮 — 乘车人 Tab', () => {
  for (const item of casesForOrders(FIXTURE.historyPassenger, 'passenger')) {
    it(`${item.id} · ${item.status} → [${item.expected.join(', ')}]`, () => {
      const order = FIXTURE.historyPassenger.find((o) => o.id === item.id)
      assert.deepEqual(statusActions(order, 'passenger'), item.expected)
    })
  }
})

describe('M1 订单操作按钮 — 车主 Tab（仅接单来源）', () => {
  for (const item of casesForOrders(FIXTURE.historyOwner, 'owner')) {
    it(`${item.id} · ${item.status} · accept → [${item.expected.join(', ')}]`, () => {
      const order = FIXTURE.historyOwner.find((o) => o.id === item.id)
      assert.equal(order.createdFrom, 'accept')
      assert.deepEqual(statusActions(order, 'owner'), item.expected)
    })
  }
})

describe('M1 统一详情页 — buildDetailActions', () => {
  it('司机待出发 → 完成 + Chat + 取消匹配', () => {
    const order = {
      id: 'syn-wait',
      status: STATUS.WAITING,
      createdFrom: 'accept',
      partnerName: 'Alice'
    }
    const actions = buildDetailActions(order, 'owner', { canComplete: true })
    assert.deepEqual(
      actions.map((item) => item.label),
      ['完成', '进入 Chat', '取消匹配']
    )
    assert.equal(actions[2].key, ACTION_KEY.CANCEL_DRIVER)
    assert.equal(actions[0].primary, true)
  })

  it('广场匹配单 → 确认接单', () => {
    const order = {
      id: 'syn-match',
      status: STATUS.MATCHING,
      from: 'A',
      to: 'B'
    }
    const actions = buildDetailActions(order, 'owner', { canAccept: true })
    assert.deepEqual(actions.map((item) => item.label), ['确认接单'])
    assert.equal(actions[0].primary, true)
  })
})

describe('M1 危险操作标记', () => {
  it('取消搭车单 / 取消匹配 属于危险操作', () => {
    assert.ok(DANGER_ACTIONS.includes('取消搭车单'))
    assert.ok(DANGER_ACTIONS.includes('取消匹配'))
    assert.equal(DANGER_ACTIONS.includes('停止匹配'), false)
  })
})

describe('M1 订单操作 — 边界合成单', () => {
  it('车主 · 已完成 · 接单 → 仅进入 Chat', () => {
    const order = {
      id: 'syn-done-accept',
      status: STATUS.DONE,
      createdFrom: 'accept',
      partnerName: 'Alice'
    }
    assert.deepEqual(statusActions(order, 'owner'), ['进入 Chat'])
  })

  it('车主 · 匹配中（P0 不应出现）→ 无操作', () => {
    const order = {
      id: 'syn-matching-owner',
      status: STATUS.MATCHING,
      createdFrom: 'accept'
    }
    assert.deepEqual(statusActions(order, 'owner'), [])
  })
})
