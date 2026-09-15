/**
 * M4 — 聊天系统消息文案（云函数侧）
 * 部署副本：微信上传 order 云函数时只打包 cloudfunctions/order/，须与本目录文件保持一致。
 */

const SYSTEM_EVENTS = {
  ORDER_ACCEPTED: 'order_accepted',
  ORDER_CANCELLED_PASSENGER: 'order_cancelled_passenger',
  ORDER_CANCELLED_DRIVER: 'order_cancelled_driver',
  TRIP_STARTED: 'trip_started',
  TRIP_COMPLETED: 'trip_completed',
  PASSENGER_COUNT_CHANGED: 'passenger_count_changed'
}

function buildSystemMessageContent(event, payload) {
  const data = payload || {}

  switch (event) {
    case SYSTEM_EVENTS.ORDER_ACCEPTED:
      return `${data.driverName || '司机'} 已接单，订单进入待出发`
    case SYSTEM_EVENTS.ORDER_CANCELLED_PASSENGER:
      return '乘客已取消搭车单'
    case SYSTEM_EVENTS.ORDER_CANCELLED_DRIVER:
      return '司机已取消匹配，订单重新匹配中'
    case SYSTEM_EVENTS.TRIP_STARTED:
      return '行程已开始'
    case SYSTEM_EVENTS.TRIP_COMPLETED:
      return '订单已完成'
    case SYSTEM_EVENTS.PASSENGER_COUNT_CHANGED:
      return `乘车人数已更新为 ${data.passengerCount || 1} 人`
    default:
      return ''
  }
}

module.exports = {
  SYSTEM_EVENTS,
  buildSystemMessageContent
}
