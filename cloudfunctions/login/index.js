const cloud = require('wx-server-sdk')
const { findUserByWechatOpenId } = require('./common/account-id')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const users = db.collection('users')

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) {
      return { ok: false, code: 'NOT_AUTHENTICATED', message: '无法识别当前用户' }
    }

    const user = await findUserByWechatOpenId(users, OPENID)

    return {
      ok: true,
      data: {
        openId: user ? user.openId : null,
        user: user ? sanitizeUser(user) : null
      }
    }
  } catch (error) {
    console.error('[login] failed', { name: error && error.name })
    return { ok: false, code: 'LOGIN_FAILED', message: '登录服务暂时不可用' }
  }
}

function sanitizeUser(user) {
  return {
    openId: user.openId,
    email: user.email || '',
    emailVerified: user.emailVerified === true,
    emailVerificationMode: user.emailVerificationMode || '',
    displayName: user.displayName || '',
    nickName: user.nickName || user.displayName || '',
    avatarUrl: user.avatarUrl || '',
    phone: user.phone || '',
    department: user.department || '',
    identities: Array.isArray(user.identities) ? user.identities : [],
    onboardingComplete: user.onboardingComplete === true,
    userMode: user.userMode || 'owner',
    vehicle: user.vehicle || null,
    preference: user.preference || null,
    habitTags: Array.isArray(user.habitTags) ? user.habitTags : []
  }
}
