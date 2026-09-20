/**
 * 聊天本地 Mock 存储 — useCloud: false 时使用
 */

const stickers = require('./stickers')

const STORAGE_KEY = 'm4_chat_messages_v1'
const PAGE_SIZE = 50
const CHAT_STATUSES = new Set(['pending_departure', 'in_progress'])

function readAll() {
  return wx.getStorageSync(STORAGE_KEY) || []
}

function writeAll(list) {
  wx.setStorageSync(STORAGE_KEY, list)
}

function avatarLetter(name) {
  const text = String(name || 'U').trim()
  return text ? text.charAt(0).toUpperCase() : 'U'
}

function profileToParticipant(name, avatarUrl) {
  const safeName = String(name || '用户').slice(0, 40)
  return {
    name: safeName,
    avatarUrl: avatarUrl ? String(avatarUrl) : '',
    avatarLetter: avatarLetter(safeName)
  }
}

function getParticipants(order) {
  return {
    passenger: profileToParticipant(order.passengerName),
    driver: profileToParticipant(order.driverName)
  }
}

function peerOpenId(order, openId) {
  if (order.passengerOpenId === openId) return order.driverOpenId || ''
  if (order.driverOpenId === openId) return order.passengerOpenId || ''
  return ''
}

function participantForSender(order, participants, senderOpenId, senderNameHint) {
  if (senderOpenId === order.passengerOpenId) return participants.passenger
  if (senderOpenId === order.driverOpenId) return participants.driver
  const hint = String(senderNameHint || '').trim()
  if (hint && hint !== '用户') return profileToParticipant(hint)
  return profileToParticipant(order.passengerName || order.driverName || '乘客')
}

function serializeMessage(doc, order, participants, viewerOpenId) {
  if (doc.type === 'system') {
    return {
      _id: doc._id,
      orderId: doc.orderId,
      type: 'system',
      systemEvent: doc.systemEvent || '',
      content: doc.content || '',
      createdAt: doc.createdAt,
      isSystem: true,
      isMine: false,
      isRead: false
    }
  }

  const otherOpenId = peerOpenId(order, viewerOpenId)
  const readBy = Array.isArray(doc.readBy) ? doc.readBy : []
  const isMine = doc.senderOpenId === viewerOpenId
  const sender = participantForSender(order, participants, doc.senderOpenId, doc.senderName)

  return {
    _id: doc._id,
    orderId: doc.orderId,
    type: doc.type || 'text',
    content: doc.content || '',
    stickerId: doc.stickerId || '',
    voiceFileId: doc.voiceFileId || '',
    voiceLocalPath: doc.voiceLocalPath || '',
    durationSec: doc.durationSec || 0,
    senderOpenId: doc.senderOpenId,
    senderName: doc.senderName || sender.name,
    senderAvatarUrl: sender.avatarUrl,
    senderAvatarLetter: sender.avatarLetter,
    readBy: readBy.slice(),
    createdAt: doc.createdAt,
    isMine,
    isRead: isMine ? readBy.includes(otherOpenId) : false
  }
}

function getAuthorizedOrder(orderId, openId) {
  const orderService = require('../order/service')
  const order = orderService.getOrderById(orderId)
  if (!order) {
    const error = new Error('ORDER_NOT_FOUND')
    error.code = 'ORDER_NOT_FOUND'
    throw error
  }
  if (order.passengerOpenId !== openId && order.driverOpenId !== openId) {
    const error = new Error('FORBIDDEN')
    error.code = 'FORBIDDEN'
    throw error
  }
  if (!CHAT_STATUSES.has(order.status)) {
    const error = new Error('CHAT_NOT_AVAILABLE')
    error.code = 'CHAT_NOT_AVAILABLE'
    throw error
  }
  return order
}

function resolveSenderName(order, openId) {
  if (openId === order.passengerOpenId) return order.passengerName || '乘客'
  if (openId === order.driverOpenId) return order.driverName || '司机'
  return '用户'
}

function insertSeedMessages(seedMessages) {
  const existing = readAll()
  const ids = new Set(existing.map((item) => item._id))
  const next = [...existing]
  seedMessages.forEach((item) => {
    if (!item || !item._id || ids.has(item._id)) return
    next.push({ ...item })
  })
  writeAll(next)
}

function listMessages(orderId, openId, options) {
  const order = getAuthorizedOrder(orderId, openId)
  const participants = getParticipants(order)
  const before = options && options.before ? options.before : ''
  let list = readAll()
    .filter((item) => item.orderId === orderId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  if (before) {
    const cutoff = new Date(before).getTime()
    if (!Number.isNaN(cutoff)) {
      list = list.filter((item) => new Date(item.createdAt).getTime() < cutoff)
    }
  }

  const page = list.slice(-PAGE_SIZE)
  const hasMore = list.length > PAGE_SIZE

  return {
    messages: page.map((doc) => serializeMessage(doc, order, participants, openId)),
    hasMore,
    participants
  }
}

function markMessagesRead(orderId, openId) {
  const order = getAuthorizedOrder(orderId, openId)
  const otherOpenId = peerOpenId(order, openId)
  if (!otherOpenId) return { marked: 0 }

  const all = readAll()
  let marked = 0
  const next = all.map((doc) => {
    if (doc.orderId !== orderId || doc.senderOpenId !== otherOpenId || doc.type === 'system') {
      return doc
    }
    const readBy = Array.isArray(doc.readBy) ? doc.readBy.slice() : []
    if (readBy.includes(openId)) return doc
    readBy.push(openId)
    marked += 1
    return { ...doc, readBy }
  })
  if (marked) writeAll(next)
  return { marked }
}

function sendText(orderId, openId, content) {
  const order = getAuthorizedOrder(orderId, openId)
  const text = String(content || '').trim()
  if (!text || text.length > 500) {
    const error = new Error('INVALID_CONTENT')
    error.code = 'INVALID_CONTENT'
    throw error
  }

  const payload = {
    _id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderId,
    type: 'text',
    content: text,
    stickerId: '',
    senderOpenId: openId,
    senderName: resolveSenderName(order, openId),
    readBy: [openId],
    createdAt: new Date().toISOString()
  }
  const all = readAll()
  all.push(payload)
  writeAll(all)

  const participants = getParticipants(order)
  return serializeMessage(payload, order, participants, openId)
}

function sendVoice(orderId, openId, payload) {
  const order = getAuthorizedOrder(orderId, openId)
  const voiceLocalPath = payload && payload.voiceLocalPath ? String(payload.voiceLocalPath) : ''
  const durationSec = Math.max(1, Math.min(60, Math.round(Number(payload && payload.durationSec) || 1)))

  if (!voiceLocalPath) {
    const error = new Error('INVALID_VOICE')
    error.code = 'INVALID_VOICE'
    throw error
  }

  const doc = {
    _id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderId,
    type: 'voice',
    content: '[语音]',
    voiceLocalPath,
    durationSec,
    stickerId: '',
    senderOpenId: openId,
    senderName: resolveSenderName(order, openId),
    readBy: [openId],
    createdAt: new Date().toISOString()
  }
  const all = readAll()
  all.push(doc)
  writeAll(all)

  const participants = getParticipants(order)
  return serializeMessage(doc, order, participants, openId)
}

function sendSticker(orderId, openId, stickerId) {
  const order = getAuthorizedOrder(orderId, openId)
  const sticker = stickers.getStickerById(stickerId)
  if (!sticker) {
    const error = new Error('INVALID_STICKER')
    error.code = 'INVALID_STICKER'
    throw error
  }

  const payload = {
    _id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderId,
    type: 'sticker',
    content: sticker.label,
    stickerId: sticker.id,
    senderOpenId: openId,
    senderName: resolveSenderName(order, openId),
    readBy: [openId],
    createdAt: new Date().toISOString()
  }
  const all = readAll()
  all.push(payload)
  writeAll(all)

  const participants = getParticipants(order)
  return serializeMessage(payload, order, participants, openId)
}

function appendSystemMessage(orderId, event, payload) {
  const { buildSystemMessageContent } = require('./system-events')
  const content = buildSystemMessageContent(event, payload)
  if (!content) return null

  const doc = {
    _id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderId,
    type: 'system',
    systemEvent: event,
    content,
    senderOpenId: 'system',
    senderName: '系统消息',
    readBy: [],
    createdAt: new Date().toISOString()
  }
  const all = readAll()
  all.push(doc)
  writeAll(all)
  return doc
}

module.exports = {
  insertSeedMessages,
  listMessages,
  markMessagesRead,
  sendText,
  sendVoice,
  sendSticker,
  appendSystemMessage
}
