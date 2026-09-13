// SECURITY-REVIEW: 聊天以邮箱账号 ID 授权；微信 OpenID 仅用于解析当前用户。
const cloud = require('wx-server-sdk')
const { resolveAccountId } = require('./common/account-id')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const messages = db.collection('messages')
const orders = db.collection('orders')
const users = db.collection('users')
const CHAT_STATUSES = new Set(['pending_departure', 'in_progress'])
const PAGE_SIZE = 50
const STICKER_IDS = new Set([
  'no_work',
  'review_prd',
  'l9',
  'eye_hint',
  'what_happened',
  'speechless'
])
const STICKER_LABELS = {
  no_work: '你没活儿么',
  review_prd: '还在和老板 review PRD',
  l9: '理想L9?',
  eye_hint: '给你个眼神自己体会',
  what_happened: '怎么回事！',
  speechless: '？？？'
}

function ok(data) {
  return { ok: true, data }
}

function fail(code, message) {
  return { ok: false, code, message }
}

function avatarLetter(name) {
  const text = String(name || 'U').trim()
  return text ? text.charAt(0).toUpperCase() : 'U'
}

function profileToParticipant(user, fallbackName, roleLabel) {
  const raw = String(
    (user && (user.displayName || user.nickName)) || fallbackName || roleLabel || ''
  ).trim()
  const name = (raw && raw !== '用户' ? raw : roleLabel || '乘客').slice(0, 40)
  return {
    name,
    avatarUrl: user && user.avatarUrl ? String(user.avatarUrl) : '',
    avatarLetter: avatarLetter(name)
  }
}

async function getAuthorizedOrder(orderId, openId) {
  const response = await orders.where({ _id: String(orderId || '').trim() }).limit(1).get()
  const order = response.data[0]
  if (!order) throw Object.assign(new Error('ORDER_NOT_FOUND'), { code: 'ORDER_NOT_FOUND' })
  if (order.passengerOpenId !== openId && order.driverOpenId !== openId) {
    throw Object.assign(new Error('FORBIDDEN'), { code: 'FORBIDDEN' })
  }
  if (!CHAT_STATUSES.has(order.status)) {
    throw Object.assign(new Error('CHAT_NOT_AVAILABLE'), { code: 'CHAT_NOT_AVAILABLE' })
  }
  return order
}

function peerOpenId(order, openId) {
  if (order.passengerOpenId === openId) return order.driverOpenId || ''
  if (order.driverOpenId === openId) return order.passengerOpenId || ''
  return ''
}

async function getOrderParticipants(order) {
  const openIds = [order.passengerOpenId, order.driverOpenId].filter(Boolean)
  if (!openIds.length) {
    return {
      passenger: profileToParticipant(null, order.passengerName, '乘客'),
      driver: profileToParticipant(null, order.driverName, '司机')
    }
  }

  const response = await users.where({ openId: _.in(openIds) }).get()
  const byOpenId = {}
  response.data.forEach((item) => {
    byOpenId[item.openId] = item
  })

  return {
    passenger: profileToParticipant(byOpenId[order.passengerOpenId], order.passengerName, '乘客'),
    driver: profileToParticipant(byOpenId[order.driverOpenId], order.driverName, '司机')
  }
}

async function senderName(openId, fallbackName) {
  const response = await users.where({ openId }).limit(1).get()
  const user = response.data[0]
  const fromUser = user ? String(user.displayName || user.nickName || '').trim() : ''
  if (fromUser && fromUser !== '用户') return fromUser.slice(0, 40)
  const fromFallback = String(fallbackName || '').trim()
  if (fromFallback && fromFallback !== '用户') return fromFallback.slice(0, 40)
  return '乘客'
}

function resolveSenderFallbackName(order, accountId) {
  if (!order || !accountId) return ''
  if (order.passengerOpenId === accountId) return order.passengerName || '乘客'
  if (order.driverOpenId === accountId) return order.driverName || '司机'
  return ''
}

function participantForSender(order, participants, senderOpenId, senderNameHint) {
  if (senderOpenId === order.passengerOpenId) return participants.passenger
  if (senderOpenId === order.driverOpenId) return participants.driver
  const hint = String(senderNameHint || '').trim()
  if (hint && hint !== '用户') return profileToParticipant(null, hint)
  return profileToParticipant(null, order.passengerName || order.driverName || '乘客')
}

function serializeMessage(doc, order, participants, viewerOpenId) {
  if (doc.type === 'system') {
    const { _openid, readBy: _readBy, ...safe } = doc
    return {
      ...safe,
      type: 'system',
      systemEvent: doc.systemEvent || '',
      content: doc.content || '',
      isSystem: true,
      isMine: false,
      isRead: false
    }
  }

  const otherOpenId = peerOpenId(order, viewerOpenId)
  const readBy = Array.isArray(doc.readBy) ? doc.readBy : []
  const isMine = doc.senderOpenId === viewerOpenId
  const sender = participantForSender(order, participants, doc.senderOpenId, doc.senderName)
  const { _openid, readBy: _readBy, ...safe } = doc

  return {
    ...safe,
    senderName: doc.senderName || sender.name,
    senderAvatarUrl: sender.avatarUrl,
    senderAvatarLetter: sender.avatarLetter,
    isMine,
    isRead: isMine ? readBy.includes(otherOpenId) : false
  }
}

async function listMessages(orderId, openId, before) {
  const order = await getAuthorizedOrder(orderId, openId)
  const participants = await getOrderParticipants(order)
  const where = { orderId }
  if (before) {
    const date = new Date(before)
    if (!Number.isNaN(date.getTime())) where.createdAt = _.lt(date)
  }

  const response = await messages
    .where(where)
    .orderBy('createdAt', 'desc')
    .limit(PAGE_SIZE)
    .get()

  const list = response.data
    .reverse()
    .map((doc) => serializeMessage(doc, order, participants, openId))

  return {
    messages: list,
    hasMore: response.data.length === PAGE_SIZE,
    participants
  }
}

async function markMessagesRead(orderId, openId) {
  const order = await getAuthorizedOrder(orderId, openId)
  const otherOpenId = peerOpenId(order, openId)
  if (!otherOpenId) return { marked: 0 }

  const response = await messages
    .where({ orderId, senderOpenId: otherOpenId })
    .limit(100)
    .get()

  let marked = 0
  await Promise.all(
    response.data.map(async (doc) => {
      const readBy = Array.isArray(doc.readBy) ? doc.readBy.slice() : []
      if (readBy.includes(openId)) return
      readBy.push(openId)
      marked += 1
      await messages.doc(doc._id).update({ data: { readBy } })
    })
  )

  return { marked }
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return fail('NOT_AUTHENTICATED', '请先登录')
    const accountId = await resolveAccountId(users, OPENID)
    const orderId = String(event.orderId || '').trim()
    if (!orderId) return fail('INVALID_INPUT', '订单 ID 无效')
    if (event.action === 'list') {
      const result = await listMessages(orderId, accountId, event.before)
      return ok(result)
    }

    if (event.action === 'markRead') {
      const result = await markMessagesRead(orderId, accountId)
      return ok(result)
    }

    const order = await getAuthorizedOrder(orderId, accountId)
    const senderFallbackName = resolveSenderFallbackName(order, accountId)

    if (event.action === 'send' || event.action === 'sendSticker' || event.action === 'sendVoice') {
      const stickerId = String(event.stickerId || '').trim()
      const isVoice = event.type === 'voice' || event.action === 'sendVoice'
      const isSticker =
        !isVoice &&
        (event.action === 'sendSticker' ||
          event.type === 'sticker' ||
          (stickerId && STICKER_IDS.has(stickerId)))

      if (isVoice) {
        const voiceFileId = String(event.voiceFileId || '').trim()
        const durationSec = Math.round(Number(event.durationSec))
        if (!voiceFileId) {
          return fail('INVALID_VOICE', '语音文件无效')
        }
        if (!Number.isFinite(durationSec) || durationSec < 1 || durationSec > 60) {
          return fail('INVALID_VOICE', '语音时长须在 1–60 秒')
        }

        const payload = {
          orderId,
          type: 'voice',
          content: '[语音]',
          voiceFileId,
          durationSec,
          senderOpenId: accountId,
          senderName: await senderName(accountId, senderFallbackName),
          readBy: [accountId],
          createdAt: db.serverDate()
        }
        const response = await messages.add({ data: payload })
        return ok({
          _id: response._id,
          orderId,
          type: 'voice',
          content: payload.content,
          voiceFileId,
          durationSec,
          senderName: payload.senderName,
          isMine: true,
          isRead: false,
          readBy: payload.readBy,
          createdAt: new Date()
        })
      }

      if (isSticker) {
        if (!STICKER_IDS.has(stickerId)) {
          return fail('INVALID_STICKER', '不支持的表情')
        }
        const payload = {
          orderId,
          type: 'sticker',
          stickerId,
          content: STICKER_LABELS[stickerId] || '[表情]',
          senderOpenId: accountId,
          senderName: await senderName(accountId, senderFallbackName),
          readBy: [accountId],
          createdAt: db.serverDate()
        }
        const response = await messages.add({ data: payload })
        return ok({
          _id: response._id,
          orderId,
          type: 'sticker',
          stickerId,
          senderName: payload.senderName,
          content: payload.content,
          isMine: true,
          isRead: false,
          readBy: payload.readBy,
          createdAt: new Date()
        })
      }

      const content = String(event.content || '').trim()
      if (!content || content.length > 500) {
        return fail('INVALID_CONTENT', '消息内容须为 1–500 字')
      }
      const payload = {
        orderId,
        type: 'text',
        content,
        senderOpenId: accountId,
        senderName: await senderName(accountId, senderFallbackName),
        readBy: [accountId],
        createdAt: db.serverDate()
      }
      const response = await messages.add({ data: payload })
      return ok({
        _id: response._id,
        orderId,
        type: 'text',
        stickerId: '',
        senderName: payload.senderName,
        content: payload.content,
        isMine: true,
        isRead: false,
        readBy: payload.readBy,
        createdAt: new Date()
      })
    }

    return fail('INVALID_ACTION', '不支持的聊天操作')
  } catch (error) {
    const messagesByCode = {
      ORDER_NOT_FOUND: '订单不存在',
      FORBIDDEN: '无权访问此聊天',
      CHAT_NOT_AVAILABLE: '当前订单状态不可聊天',
      INVALID_STICKER: '不支持的表情',
      INVALID_VOICE: '语音消息无效'
    }
    if (messagesByCode[error && error.code]) {
      return fail(error.code, messagesByCode[error.code])
    }
    console.error('[message] failed', { name: error && error.name })
    return fail('MESSAGE_SERVICE_FAILED', '聊天服务暂时不可用')
  }
}
