/**
 * 聊天本地自测 — 固定 seed_chat_demo 订单（Alice 乘客 + Bob 司机，待出发）
 * 仅在 useCloud: false 时于 app 启动写入
 */

const { ORDER_STATUS } = require('./constants/status')
const {
  buildAvailableSlotsForDate,
  formatDepartTimeForStorage
} = require('./time-slots')
const { normalizeEmail } = require('../auth/email')
const { snapshotDriverVehicle } = require('./driver-vehicle')
const { findMockTestUser } = require('../auth/mock-users')

const CHAT_DEMO_ORDER_ID = 'seed_chat_demo'
const MESSAGE_SEED_FLAG = 'm4_chat_demo_messages_seeded_v2'

function mockOpenId(email) {
  const normalized = normalizeEmail(email || '')
  return normalized ? `mock_${normalized.replace(/[^a-z0-9]/g, '_')}` : ''
}

function formatDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function buildChatDemoOrder(now) {
  const alice = findMockTestUser('alice.passenger@disney.com')
  const bob = findMockTestUser('bob.driver@disney.com')
  if (!alice || !bob) return null

  const dateStr = formatDateStr(now)
  const slots = buildAvailableSlotsForDate(dateStr, now)
  const slot = slots[1] || slots[0]
  if (!slot) return null

  const { departTime, departTimeEnd } = formatDepartTimeForStorage(dateStr, slot)
  const timestamp = now.toISOString()

  return {
    _id: CHAT_DEMO_ORDER_ID,
    fromPointId: 'poi-06',
    toPointId: 'poi-08',
    departTime,
    departTimeEnd,
    passengerCount: 1,
    note: '聊天自测单 · 可在详情页进入聊天',
    status: ORDER_STATUS.PENDING_DEPARTURE,
    passengerOpenId: mockOpenId(alice.email),
    passengerName: alice.userInfo.displayName || 'Alice',
    driverOpenId: mockOpenId(bob.email),
    driverName: bob.userInfo.displayName || 'Bob',
    driverVehicle: snapshotDriverVehicle(bob.vehicle),
    matchedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function seedChatDemoMessages(order, now) {
  if (wx.getStorageSync(MESSAGE_SEED_FLAG)) return

  const mockStore = require('../chat/mock-store')
  const baseTime = now.getTime()
  mockStore.insertSeedMessages([
    {
      _id: 'chat_demo_msg_sys_accept',
      orderId: order._id,
      type: 'system',
      systemEvent: 'order_accepted',
      content: `${order.driverName || '司机'} 已接单，订单进入待出发`,
      senderOpenId: 'system',
      senderName: '系统消息',
      readBy: [],
      createdAt: new Date(baseTime - 8 * 60 * 1000).toISOString()
    },
    {
      _id: 'chat_demo_msg_1',
      orderId: order._id,
      type: 'text',
      content: '你好，我准时到上车点～',
      senderOpenId: order.passengerOpenId,
      senderName: order.passengerName,
      readBy: [order.passengerOpenId],
      createdAt: new Date(baseTime - 5 * 60 * 1000).toISOString()
    },
    {
      _id: 'chat_demo_msg_2',
      orderId: order._id,
      type: 'text',
      content: '好的，我已在路上，预计 5 分钟到。',
      senderOpenId: order.driverOpenId,
      senderName: order.driverName,
      readBy: [order.driverOpenId],
      createdAt: new Date(baseTime - 3 * 60 * 1000).toISOString()
    }
  ])
  wx.setStorageSync(MESSAGE_SEED_FLAG, '1')
}

function ensureChatDevSeed(now) {
  const service = require('./service')
  const order = buildChatDemoOrder(now || new Date())
  if (!order) return null

  service.upsertOrder(order)
  seedChatDemoMessages(order, now || new Date())
  return order
}

module.exports = {
  CHAT_DEMO_ORDER_ID,
  ensureChatDevSeed
}
