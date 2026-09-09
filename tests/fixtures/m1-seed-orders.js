/**
 * M1 历史列表 UI 测试用固定订单（不注入 App 运行时）
 */
const { STATUS } = require('../../miniprogram/modules/auth/order-status')

const MOCK_PASSENGER_ORDERS = [
  {
    id: 'p-matching',
    fromPointId: 'poi-01',
    toPointId: 'poi-03',
    from: '米奇大街',
    to: '迪士尼团队大楼',
    dateLabel: '8月13日 周三',
    timeLabel: '17:00',
    sortAt: 500,
    status: STATUS.MATCHING,
    count: 2,
    note: ''
  },
  {
    id: 'p-waiting',
    fromPointId: 'poi-05',
    toPointId: 'poi-09',
    from: '中央厨房（北门）',
    to: '明日世界',
    dateLabel: '8月14日 周四',
    timeLabel: '09:00',
    sortAt: 480,
    status: STATUS.WAITING,
    count: 1,
    partnerName: 'Ray Gong',
    note: ''
  },
  {
    id: 'p-trip',
    fromPointId: 'poi-01',
    toPointId: 'poi-08',
    from: '米奇大街',
    to: '西门',
    dateLabel: '8月14日 周四',
    timeLabel: '08:00',
    sortAt: 460,
    status: STATUS.TRIP,
    count: 1,
    partnerName: 'Ray Gong',
    note: '携带大件行李'
  },
  {
    id: 'p-done',
    fromPointId: 'poi-03',
    toPointId: 'poi-08',
    from: '迪士尼团队大楼',
    to: '西门',
    dateLabel: '8月12日 周二',
    timeLabel: '17:30',
    sortAt: 200,
    status: STATUS.DONE,
    count: 1,
    partnerName: 'Ray Gong',
    note: ''
  },
  {
    id: 'p-closed',
    fromPointId: 'poi-01',
    toPointId: 'poi-08',
    from: '米奇大街',
    to: '西门',
    dateLabel: '8月5日 周二',
    timeLabel: '18:00',
    sortAt: 50,
    status: STATUS.CLOSED,
    count: 1,
    closedReason: '已取消',
    note: ''
  }
]

const MOCK_OWNER_ORDERS = [
  {
    id: 'o-waiting-accept',
    fromPointId: 'poi-09',
    toPointId: 'poi-08',
    from: '明日世界',
    to: '西门',
    dateLabel: '8月14日 周四',
    timeLabel: '07:30',
    sortAt: 490,
    status: STATUS.WAITING,
    count: 1,
    partnerName: 'Liz Sun',
    createdFrom: 'accept',
    hasPublishTrip: false
  },
  {
    id: 'o-trip-accept',
    fromPointId: 'poi-03',
    toPointId: 'poi-08',
    from: '迪士尼团队大楼',
    to: '西门',
    dateLabel: '8月13日 周三',
    timeLabel: '08:00',
    sortAt: 470,
    status: STATUS.TRIP,
    count: 1,
    partnerName: 'Liz Sun',
    createdFrom: 'accept',
    hasPublishTrip: false,
    note: '准时出发'
  },
  {
    id: 'o-done-accept',
    fromPointId: 'poi-05',
    toPointId: 'poi-10',
    from: '中央厨房（北门）',
    to: '迪士尼乐园酒店',
    dateLabel: '8月12日 周二',
    timeLabel: '17:30',
    sortAt: 210,
    status: STATUS.DONE,
    count: 1,
    partnerName: 'Liz Sun',
    createdFrom: 'accept',
    hasPublishTrip: false
  },
  {
    id: 'o-closed-accept',
    fromPointId: 'poi-01',
    toPointId: 'poi-08',
    from: '米奇大街',
    to: '西门',
    dateLabel: '8月5日 周二',
    timeLabel: '18:00',
    sortAt: 40,
    status: STATUS.CLOSED,
    count: 1,
    partnerName: 'Liz Sun',
    createdFrom: 'accept',
    hasPublishTrip: false,
    closedReason: '司机已取消'
  }
]

const FIXTURE = {
  historyOwner: MOCK_OWNER_ORDERS,
  historyPassenger: MOCK_PASSENGER_ORDERS
}

function cloneSeedOrders() {
  return {
    historyOwner: JSON.parse(JSON.stringify(MOCK_OWNER_ORDERS)),
    historyPassenger: JSON.parse(JSON.stringify(MOCK_PASSENGER_ORDERS))
  }
}

module.exports = {
  MOCK_PASSENGER_ORDERS,
  MOCK_OWNER_ORDERS,
  FIXTURE,
  cloneSeedOrders
}
