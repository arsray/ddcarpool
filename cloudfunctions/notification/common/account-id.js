/**
 * 账号 ID：以邮箱为准（MVP），不绑定微信 OpenID 为账号主键。
 * 微信 OpenID 仅记录在 lastWechatOpenId，用于当前设备会话识别。
 */

function emailToAccountId(email) {
  return `acct_${String(email).toLowerCase().replace(/[^a-z0-9]/g, '_')}`
}

async function findUserByEmail(users, email) {
  const response = await users.where({ email }).limit(1).get()
  return response.data[0] || null
}

async function findUserByWechatOpenId(users, wechatOpenId) {
  const response = await users.where({ lastWechatOpenId: wechatOpenId }).limit(1).get()
  return response.data[0] || null
}

async function resolveAccountId(users, wechatOpenId) {
  const user = await findUserByWechatOpenId(users, wechatOpenId)
  if (user && user.openId) return user.openId
  return wechatOpenId
}

module.exports = {
  emailToAccountId,
  findUserByEmail,
  findUserByWechatOpenId,
  resolveAccountId
}
