/** 预览 Mock 种子版本：改测试订单时递增，自动刷新本地缓存 */
const MOCK_SEED_VERSION = 6

const { STATUS } = require('./order-status')
const { enrichOrderForList } = require('./order-display')

const MOCK_PASSENGER_ORDERS = []

const MOCK_OWNER_ORDERS = []

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
  notifications: []
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
