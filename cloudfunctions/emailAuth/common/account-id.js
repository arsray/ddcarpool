/**
 * 账号 ID：以邮箱 derived acct_* 为主键。
 * 微信 OPENID 仅用于 claimWechatBinding（当前设备登录了哪个邮箱账号）。
 */

function emailToAccountId(email) {
  return `acct_${String(email).toLowerCase().replace(/[^a-z0-9]/g, '_')}`
}

function authError(code, message) {
  return Object.assign(new Error(code), { code, publicMessage: message })
}

async function findUserByEmail(users, email) {
  const response = await users.where({ email }).limit(1).get()
  return response.data[0] || null
}

async function findUserByAccountId(users, accountId) {
  const id = String(accountId || '').trim()
  if (!id) return null
  const response = await users.where({ openId: id }).limit(1).get()
  return response.data[0] || null
}

/** @deprecated 勿用于解析当前会话；仅兼容旧脚本 */
async function findUserByWechatOpenId(users, wechatOpenId) {
  const response = await users.where({ lastWechatOpenId: wechatOpenId }).limit(1).get()
  return response.data[0] || null
}

async function clearOtherWechatBindings(users, db, wechatOpenId, keepAccountId) {
  const response = await users.where({ lastWechatOpenId: wechatOpenId }).limit(100).get()
  const now = db.serverDate()
  for (const doc of response.data) {
    if (doc.openId !== keepAccountId) {
      await users.doc(doc._id).update({
        data: { lastWechatOpenId: '', updatedAt: now }
      })
    }
  }
}

async function claimWechatBinding(users, db, wechatOpenId, accountId) {
  const normalized = String(accountId || '').trim()
  if (!normalized || !wechatOpenId) return null
  await clearOtherWechatBindings(users, db, wechatOpenId, normalized)
  const user = await findUserByAccountId(users, normalized)
  if (!user) return null
  const now = db.serverDate()
  await users.doc(user._id).update({
    data: { lastWechatOpenId: wechatOpenId, updatedAt: now }
  })
  return findUserByAccountId(users, normalized)
}

async function resolveAccountId(users, wechatOpenId, clientAccountId) {
  const accountId = String(clientAccountId || '').trim()
  if (!accountId) {
    throw authError('NOT_LOGGED_IN', '请先登录')
  }
  const user = await findUserByAccountId(users, accountId)
  if (!user || user.lastWechatOpenId !== wechatOpenId) {
    throw authError('SESSION_INVALID', '登录已失效，请重新登录')
  }
  return user.openId
}

module.exports = {
  emailToAccountId,
  findUserByEmail,
  findUserByAccountId,
  findUserByWechatOpenId,
  clearOtherWechatBindings,
  claimWechatBinding,
  resolveAccountId
}
