/**
 * M1 历史列表 UI 工具（Mock 离线模式）
 * 订单数据来自真实 M3 本地存储或云端 API，不再注入写死种子单。
 */
const { STATUS } = require('./order-status')
const { enrichOrderForList } = require('./order-display')

/** 默认预览用户资料（仅 storage 缺失时的 fallback） */
const MOCK = {
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
  habitTags: ['常早班', '常走西门']
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
