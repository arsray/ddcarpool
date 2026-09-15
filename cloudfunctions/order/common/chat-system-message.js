const { buildSystemMessageContent } = require('./chat-system-events')

async function appendChatSystemMessage(db, orderId, event, payload) {
  const safeOrderId = String(orderId || '').trim()
  if (!safeOrderId) return null

  const content = buildSystemMessageContent(event, payload)
  if (!content) return null

  const response = await db.collection('messages').add({
    data: {
      orderId: safeOrderId,
      type: 'system',
      systemEvent: event,
      content,
      senderOpenId: 'system',
      senderName: '系统消息',
      readBy: [],
      createdAt: db.serverDate()
    }
  })

  return response._id
}

module.exports = {
  appendChatSystemMessage
}
