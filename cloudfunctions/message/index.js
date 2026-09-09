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

function ok(data) {
  return { ok: true, data }
}

function fail(code, message) {
  return { ok: false, code, message }
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

async function senderName(openId) {
  const response = await users.where({ openId }).limit(1).get()
  const user = response.data[0]
  return user ? String(user.displayName || user.nickName || '用户').slice(0, 40) : '用户'
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return fail('NOT_AUTHENTICATED', '请先登录')
    const accountId = await resolveAccountId(users, OPENID)
    const orderId = String(event.orderId || '').trim()
    if (!orderId) return fail('INVALID_INPUT', '订单 ID 无效')
    await getAuthorizedOrder(orderId, accountId)

    if (event.action === 'list') {
      const where = { orderId }
      if (event.before) {
        const before = new Date(event.before)
        if (!Number.isNaN(before.getTime())) where.createdAt = _.lt(before)
      }
      const response = await messages
        .where(where)
        .orderBy('createdAt', 'desc')
        .limit(PAGE_SIZE)
        .get()
      const list = response.data.reverse().map(({ _openid, senderOpenId, ...item }) => ({
        ...item,
        isMine: senderOpenId === accountId
      }))
      return ok({ messages: list, hasMore: response.data.length === PAGE_SIZE })
    }

    if (event.action === 'send') {
      const content = String(event.content || '').trim()
      if (!content || content.length > 500) {
        return fail('INVALID_CONTENT', '消息内容须为 1–500 字')
      }
      const response = await messages.add({
        data: {
          orderId,
          senderOpenId: accountId,
          senderName: await senderName(accountId),
          content,
          createdAt: db.serverDate()
        }
      })
      return ok({
        _id: response._id,
        orderId,
        senderName: await senderName(accountId),
        content,
        isMine: true,
        createdAt: new Date()
      })
    }

    return fail('INVALID_ACTION', '不支持的聊天操作')
  } catch (error) {
    const messagesByCode = {
      ORDER_NOT_FOUND: '订单不存在',
      FORBIDDEN: '无权访问此聊天',
      CHAT_NOT_AVAILABLE: '当前订单状态不可聊天'
    }
    if (messagesByCode[error && error.code]) {
      return fail(error.code, messagesByCode[error.code])
    }
    console.error('[message] failed', { name: error && error.name })
    return fail('MESSAGE_SERVICE_FAILED', '聊天服务暂时不可用')
  }
}
