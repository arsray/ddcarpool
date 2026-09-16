const mockStore = require('./mock-store')
const { SYSTEM_EVENTS } = require('./system-events')

function appendSystemMessage(orderId, event, payload) {
  return mockStore.appendSystemMessage(orderId, event, payload)
}

module.exports = {
  appendSystemMessage,
  SYSTEM_EVENTS
}
