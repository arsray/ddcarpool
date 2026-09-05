const config = require('../../config/index')
const { callFunction } = require('../../utils/cloud')

function canEnterChat(order, currentOpenId) {
  if (!order || !currentOpenId) return false
  if (!['pending_departure', 'in_progress'].includes(order.status)) return false

  if (order.viewerRole) return ['passenger', 'driver'].includes(order.viewerRole)
  return (
    order.passengerOpenId === currentOpenId ||
    order.driverOpenId === currentOpenId
  )
}

async function listMessages(orderId, options) {
  if (!config.useCloud) return { messages: [], hasMore: false }
  return callFunction('message', {
    action: 'list',
    orderId,
    before: options && options.before ? options.before : ''
  })
}

async function sendMessage(orderId, content) {
  if (!config.useCloud) {
    const error = new Error('云聊天未启用')
    error.code = 'CLOUD_DISABLED'
    throw error
  }
  return callFunction('message', { action: 'send', orderId, content })
}

module.exports = {
  canEnterChat,
  listMessages,
  sendMessage
}
