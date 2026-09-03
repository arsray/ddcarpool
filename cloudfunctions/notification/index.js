// SECURITY-REVIEW: 通知只允许接收者通过微信 OPENID 查询和更新。
const cloud = require('wx-server-sdk')

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

    if (event.action === 'list') {
      const response = await notifications
        .where({ recipientOpenId: OPENID })
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
      if (!item || item.recipientOpenId !== OPENID) {
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
