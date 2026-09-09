/**
 * M1 — 列表/详情展示：角标、副文案、筛选字段
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadModule } = require('../helpers/setup')

const { FIXTURE } = require('../fixtures/m1-seed-orders')
const { STATUS } = loadModule('modules/auth/order-status.js')
const {
  getOwnerSourceTag,
  formatStatusSubline,
  formatListHint,
  buildDetailView
} = loadModule('modules/auth/order-display.js')
const {
  prepareOrderList,
  filterOrdersByTab,
  getOngoingOrders,
  groupHistoryByStatus
} = loadModule('modules/auth/mock.js')

describe('M1 车主角标（已移除发布/接单标签）', () => {
  it('车主订单不再显示来源角标', () => {
    const order = FIXTURE.historyOwner.find((o) => o.createdFrom === 'accept')
    assert.equal(getOwnerSourceTag(order, 'owner'), '')
  })

  it('种子车主单不含 publish 来源', () => {
    assert.equal(FIXTURE.historyOwner.some((o) => o.createdFrom === 'publish'), false)
  })

  it('乘车人 Tab 不显示角标', () => {
    const order = FIXTURE.historyPassenger[0]
    assert.equal(getOwnerSourceTag(order, 'passenger'), '')
  })
})

describe('M1 状态副文案 — 种子订单全覆盖', () => {
  for (const order of FIXTURE.historyPassenger) {
    it(`乘车人 · ${order.id} · ${order.status}`, () => {
      const subline = formatStatusSubline(order, 'passenger')
      const hint = formatListHint(order, 'passenger')

      if (order.status === STATUS.MATCHING) {
        assert.equal(subline, '等待车主接单')
        assert.equal(hint, '等待车主接单')
      }
      if (order.status === STATUS.CLOSED) {
        assert.ok(order.closedReason)
        assert.equal(subline, order.closedReason)
      }
      if (order.status === STATUS.WAITING && order.partnerName) {
        assert.match(subline, /车主 .+ 已接单/)
      }
      if (order.status === STATUS.TRIP && order.partnerName) {
        assert.match(subline, /同行/)
      }
    })
  }

  for (const order of FIXTURE.historyOwner) {
    it(`车主 · ${order.id} · ${order.status}`, () => {
      const subline = formatStatusSubline(order, 'owner')

      if (order.status === STATUS.MATCHING) {
        assert.equal(subline, '等待匹配')
      }
      if (order.status === STATUS.CLOSED) {
        assert.equal(subline, order.closedReason)
      }
      if ([STATUS.WAITING, STATUS.TRIP].includes(order.status) && order.partnerName) {
        assert.match(subline, /乘客/)
      }
    })
  }
})

describe('M1 详情页结构', () => {
  it('乘车人详情含出发、路线、人数', () => {
    const order = FIXTURE.historyPassenger.find((o) => o.status === STATUS.WAITING)
    const view = buildDetailView(order, 'passenger')
    assert.equal(view.navTitle, '乘车人订单详情')
    assert.ok(view.sections.some((s) => s.label === '出发'))
    assert.ok(view.sections.some((s) => s.label === '路线'))
    assert.ok(view.sections.some((s) => s.label === '人数'))
  })

  it('车主待出发详情含乘客信息', () => {
    const order = FIXTURE.historyOwner.find((o) => o.status === STATUS.WAITING)
    const view = buildDetailView(order, 'owner')
    assert.equal(view.navTitle, '车主订单详情')
    assert.equal(view.sourceTag, '')
  })
})

describe('M1 我的订单 — 筛选 Tab', () => {
  const passengerList = FIXTURE.historyPassenger

  it('全部 = 5 条种子单', () => {
    assert.equal(filterOrdersByTab(passengerList, '全部').length, 5)
  })

  it('未完成 = 匹配中 + 待出发 + 行程中', () => {
    const ongoing = filterOrdersByTab(passengerList, '未完成')
    assert.equal(ongoing.length, 3)
    ongoing.forEach((o) => {
      assert.ok([STATUS.MATCHING, STATUS.WAITING, STATUS.TRIP].includes(o.status))
    })
  })

  it('已完成 / 已关闭 各 1 条', () => {
    assert.equal(filterOrdersByTab(passengerList, '已完成').length, 1)
    assert.equal(filterOrdersByTab(passengerList, '已关闭').length, 1)
  })

  it('prepareOrderList 附带 statusClass 与 listHint', () => {
    const list = prepareOrderList(passengerList, '全部', 'passenger')
    list.forEach((item) => {
      assert.ok(item.statusClass)
      assert.ok('listHint' in item)
      assert.ok('scheduleLine' in item)
    })
  })

  it('getOngoingOrders 按 sortAt 降序且可 limit', () => {
    const top2 = getOngoingOrders(passengerList, 2)
    assert.equal(top2.length, 2)
    assert.ok(top2[0].sortAt >= top2[1].sortAt)
  })

  it('groupHistoryByStatus 五态分组不遗漏', () => {
    const groups = groupHistoryByStatus(passengerList)
    const total = groups.reduce((sum, g) => sum + g.items.length, 0)
    assert.equal(total, passengerList.length)
    assert.equal(groups.length, 5)
  })
})
