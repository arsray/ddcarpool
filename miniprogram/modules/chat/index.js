/**
 * M4 — chat 模块
 * 接口契约见 docs/MODULE_CONTRACTS.md
 */

function notImplemented(name) {
  const err = new Error(`${name} not implemented — M4 owner`)
  err.code = 'NOT_IMPLEMENTED'
  throw err
}

function canEnterChat(order, currentOpenId) {
  if (!order || order.status !== 'matched') return false
  return (
    order.publisherOpenId === currentOpenId ||
    order.accepterOpenId === currentOpenId
  )
}

async function listMessages(_orderId) {
  notImplemented('listMessages')
}

async function sendMessage(_orderId, _content) {
  notImplemented('sendMessage')
}

module.exports = {
  canEnterChat,
  listMessages,
  sendMessage
}
