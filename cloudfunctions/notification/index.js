// SECURITY-REVIEW: 通知以邮箱账号 ID 查询；微信 OpenID 仅用于解析当前用户。
const cloud = require('wx-server-sdk')
const { resolveAccountId } = require('./common/account-id')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const notifications = db.collection('notifications')
const PAGE_SIZE = 50

function ok(data) {
  return { ok: true, data }
}

function fail(code, message) {
  return { ok: false, code, message }
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return fail('NOT_AUTHENTICATED', '请先登录')
    const accountId = await resolveAccountId(db.collection('users'), OPENID)

    if (event.action === 'list') {
      const response = await notifications
        .where({ recipientOpenId: accountId })
        .orderBy('createdAt', 'desc')
        .limit(PAGE_SIZE)
        .get()
      return ok(response.data.map(({ _openid, recipientOpenId, ...item }) => item))
    }

    if (event.action === 'markRead') {
      const notificationId = String(event.notificationId || '').trim()
      if (!notificationId) return fail('INVALID_INPUT', '通知 ID 无效')
      const response = await notifications.where({ _id: notificationId }).limit(1).get()
      const item = response.data[0]
      if (!item || item.recipientOpenId !== accountId) {
        return fail('FORBIDDEN', '无权操作此通知')
      }
      await notifications.doc(notificationId).update({
        data: { read: true, readAt: db.serverDate() }
      })
      return ok({ notificationId, read: true })
    }

    return fail('INVALID_ACTION', '不支持的通知操作')
  } catch (error) {
    console.error('[notification] failed', { name: error && error.name })
    return fail('NOTIFICATION_SERVICE_FAILED', '通知服务暂时不可用')
  }
}
