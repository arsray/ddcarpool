/**
 * UI 预览态 ↔ 官方 DATA_MODEL 字段映射
 */
const { STATUS } = require('./order-status')

const UI_TO_OFFICIAL_STATUS = {
  [STATUS.MATCHING]: 'open',
  [STATUS.WAITING]: 'matched',
  [STATUS.TRIP]: 'matched',
  [STATUS.DONE]: 'completed',
  [STATUS.CLOSED]: 'cancelled'
}

const OFFICIAL_TO_UI_STATUS = Object.fromEntries(
  Object.entries(UI_TO_OFFICIAL_STATUS).map(([ui, official]) => [official, ui])
)

function mapHistoryItemToOrder(item, role) {
  const isOwner = role === 'owner'
  return {
    _id: item.id,
    type: isOwner ? 'offer' : 'seek',
    fromPointId: item.from,
    toPointId: item.to,
    departTime: item.time,
    seats: item.count || 1,
    note: item.note || '',
    status: UI_TO_OFFICIAL_STATUS[item.status] || 'open',
    publisherOpenId: isOwner ? 'current' : item.matchedWith || '',
    publisherName: isOwner ? '我' : '',
    accepterOpenId: isOwner ? item.matchedWith || '' : 'current',
    accepterName: isOwner ? '' : '我',
    routeLabel: `${item.from} → ${item.to}`,
    uiStatus: item.status
  }
}

function listMyOrdersFromStore(store) {
  const openId = store.getOpenId()
  if (!openId) return []

  const ownerOrders = (store.getState().historyOwner || []).map((item) =>
    mapHistoryItemToOrder(item, 'owner')
  )
  const passengerOrders = (store.getState().historyPassenger || []).map((item) =>
    mapHistoryItemToOrder(item, 'passenger')
  )
  return [...ownerOrders, ...passengerOrders]
}

module.exports = {
  UI_TO_OFFICIAL_STATUS,
  OFFICIAL_TO_UI_STATUS,
  mapHistoryItemToOrder,
  listMyOrdersFromStore
}
