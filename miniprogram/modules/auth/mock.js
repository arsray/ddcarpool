/** 预览 Mock 种子版本：改测试订单时递增，自动刷新本地缓存 */
const MOCK_SEED_VERSION = 5

const { STATUS } = require('./order-status')
const { enrichOrderForList } = require('./order-display')

const MOCK_PASSENGER_ORDERS = [
  {
    id: 'p-matching',
    from: '604',
    to: '603',
    dateLabel: '8月13日 周三',
    timeLabel: '17:00',
    sortAt: 500,
    status: STATUS.MATCHING,
    count: 1,
    note: ''
  },
  {
    id: 'p-waiting',
    from: 'PAB',
    to: 'TD',
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
    from: '604',
    to: '地铁站',
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
    from: 'PAB',
    to: '603',
    dateLabel: '8月12日 周二',
    timeLabel: '17:30',
    sortAt: 200,
    status: STATUS.DONE,
    count: 1,
    partnerName: 'Ray Gong'
  },
  {
    id: 'p-closed',
    from: 'PAB',
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
    id: 'o-matching',
    from: '603',
    to: '西门',
    dateLabel: '8月13日 周三',
    timeLabel: '18:00',
    sortAt: 510,
    status: STATUS.MATCHING,
    count: 0,
    capacity: 4,
    createdFrom: 'publish',
    hasPublishTrip: true,
    note: '顺路可稍带'
  },
  {
    id: 'o-waiting-accept',
    from: 'TD',
    to: '北门',
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
    id: 'o-waiting-publish',
    from: 'PAB',
    to: 'TD',
    dateLabel: '8月14日 周四',
    timeLabel: '09:00',
    sortAt: 485,
    status: STATUS.WAITING,
    count: 1,
    partnerName: 'Liz Sun',
    createdFrom: 'publish',
    hasPublishTrip: true
  },
  {
    id: 'o-trip',
    from: '603',
    to: '西门',
    dateLabel: '8月13日 周三',
    timeLabel: '08:00',
    sortAt: 470,
    status: STATUS.TRIP,
    count: 1,
    partnerName: 'Liz Sun',
    createdFrom: 'publish',
    hasPublishTrip: true,
    note: '准时出发'
  },
  {
    id: 'o-done',
    from: 'PAB',
    to: '603',
    dateLabel: '8月12日 周二',
    timeLabel: '17:30',
    sortAt: 210,
    status: STATUS.DONE,
    count: 1,
    partnerName: 'Liz Sun',
    createdFrom: 'publish',
    hasPublishTrip: true
  },
  {
    id: 'o-closed',
    from: 'PAB',
    to: '西门',
    dateLabel: '8月5日 周二',
    timeLabel: '18:00',
    sortAt: 40,
    status: STATUS.CLOSED,
    count: 0,
    capacity: 4,
    createdFrom: 'publish',
    hasPublishTrip: true,
    closedReason: '已停止匹配'
  }
]

const MOCK = {
  seedVersion: MOCK_SEED_VERSION,
  userInfo: {
    email: 'ray.gong@disney.com',
    displayName: 'Ray Gong',
    phone: '',
    department: ''
  },
  vehicle: {
    brand: '特斯拉',
    modelType: 'SUV',
    plate: '沪A12345',
    passengerCapacity: 4,
    color: '白色'
  },
  preference: {
    defaultCount: 1,
    noteTags: ['携带大件行李'],
    note: ''
  },
  habitTags: ['常早班', '常走西门'],
  historyOwner: MOCK_OWNER_ORDERS,
  historyPassenger: MOCK_PASSENGER_ORDERS,
  notifications: [
    { id: 'n1', title: '您的车主订单已被匹配', time: '10:30', read: false, targetType: 'owner', targetId: 'o-trip' },
    { id: 'n2', title: 'Liz Sun 发来消息', time: '09:15', read: false, targetType: 'owner', targetId: 'o-trip' },
    { id: 'n3', title: '订单已完成', time: '昨天', read: true, targetType: 'owner', targetId: 'o-done' }
  ]
}

function cloneSeedOrders() {
  return {
    historyOwner: JSON.parse(JSON.stringify(MOCK_OWNER_ORDERS)),
    historyPassenger: JSON.parse(JSON.stringify(MOCK_PASSENGER_ORDERS)),
    notifications: JSON.parse(JSON.stringify(MOCK.notifications))
  }
}

function sortOrdersByTimeDesc(list) {
  return list.slice().sort((a, b) => (b.sortAt || 0) - (a.sortAt || 0))
}

function enrichOrder(item, role) {
  const { STATUS_CLASS } = require('./order-status')
  const base = enrichOrderForList(item, role)
  return {
    ...base,
    statusClass: STATUS_CLASS[item.status] || ''
  }
}

function withStatusClass(list, role) {
  return list.map((item) => enrichOrder(item, role))
}

function filterOrdersByTab(list, filter) {
  const { FILTER_TO_STATUSES } = require('./order-status')
  if (!filter || filter === '全部') return list
  const statuses = FILTER_TO_STATUSES[filter]
  if (statuses) return list.filter((item) => statuses.includes(item.status))
  return list.filter((item) => item.status === filter)
}

function getOngoingOrders(list, limit) {
  const { ONGOING_STATUSES, STATUS_CLASS } = require('./order-status')
  const ongoing = sortOrdersByTimeDesc(
    list.filter((item) => ONGOING_STATUSES.includes(item.status))
  )
  const enriched = ongoing.map((item) => ({
    ...item,
    statusClass: STATUS_CLASS[item.status] || ''
  }))
  return limit ? enriched.slice(0, limit) : enriched
}

function prepareOrderList(list, filter, role) {
  const filtered = filterOrdersByTab(list, filter)
  return withStatusClass(sortOrdersByTimeDesc(filtered), role)
}

function groupHistoryByStatus(list) {
  const { STATUS_CLASS } = require('./order-status')
  const order = [STATUS.MATCHING, STATUS.WAITING, STATUS.TRIP, STATUS.DONE, STATUS.CLOSED]
  return order
    .map((status) => ({
      status,
      statusClass: STATUS_CLASS[status],
      items: list.filter((item) => item.status === status)
    }))
    .filter((group) => group.items.length > 0)
}

function formatOrderSubtitle(order, role) {
  const { formatListHint } = require('./order-display')
  return formatListHint(order, role)
}

module.exports = {
  MOCK,
  MOCK_SEED_VERSION,
  cloneSeedOrders,
  STATUS,
  formatOrderSubtitle,
  enrichOrder,
  sortOrdersByTimeDesc,
  withStatusClass,
  filterOrdersByTab,
  getOngoingOrders,
  prepareOrderList,
  groupHistoryByStatus
}
