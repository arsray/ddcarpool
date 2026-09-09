// SECURITY-REVIEW: 用户资料以邮箱账号 ID 为主键；微信 OpenID 仅作设备会话标记。
const cloud = require('wx-server-sdk')
const {
  emailToAccountId,
  findUserByEmail,
  findUserByWechatOpenId
} = require('./common/account-id')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const users = db.collection('users')
const VALID_IDENTITIES = new Set(['owner', 'passenger'])
const VALID_MODES = new Set(['owner', 'passenger'])

function result(data) {
  return { ok: true, data }
}

function failure(code, message) {
  return { ok: false, code, message }
}

function cleanString(value, maxLength) {
  if (value == null) return ''
  return String(value).trim().slice(0, maxLength)
}

function normalizeEmail(value) {
  const email = cleanString(value, 254).toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?@disney\.com$/.test(email)) {
    throw Object.assign(new Error('INVALID_EMAIL'), { code: 'INVALID_EMAIL' })
  }
  return email
}

function sanitizeVehicle(value) {
  if (!value || typeof value !== 'object') return null
  return {
    brand: cleanString(value.brand, 40),
    modelType: cleanString(value.modelType, 40),
    plate: cleanString(value.plate, 20),
    passengerCapacity: Math.min(10, Math.max(1, Number(value.passengerCapacity) || 1)),
    color: cleanString(value.color, 20)
  }
}

function sanitizePreference(value) {
  if (!value || typeof value !== 'object') return null
  return {
    defaultCount: Math.min(10, Math.max(1, Number(value.defaultCount) || 1)),
    noteTags: Array.isArray(value.noteTags)
      ? value.noteTags.slice(0, 10).map((item) => cleanString(item, 30)).filter(Boolean)
      : [],
    note: cleanString(value.note, 100)
  }
}

function sanitizePatch(input) {
  const patch = {}
  if (Object.prototype.hasOwnProperty.call(input, 'displayName')) {
    patch.displayName = cleanString(input.displayName, 40)
    patch.nickName = patch.displayName
  }
  if (Object.prototype.hasOwnProperty.call(input, 'avatarUrl')) {
    patch.avatarUrl = cleanString(input.avatarUrl, 500)
  }
  if (Object.prototype.hasOwnProperty.call(input, 'phone')) {
    patch.phone = cleanString(input.phone, 30)
  }
  if (Object.prototype.hasOwnProperty.call(input, 'department')) {
    patch.department = cleanString(input.department, 80)
  }
  if (Object.prototype.hasOwnProperty.call(input, 'identities')) {
    patch.identities = Array.isArray(input.identities)
      ? Array.from(new Set(input.identities.filter((item) => VALID_IDENTITIES.has(item))))
      : []
  }
  if (Object.prototype.hasOwnProperty.call(input, 'userMode')) {
    if (!VALID_MODES.has(input.userMode)) {
      throw Object.assign(new Error('INVALID_USER_MODE'), { code: 'INVALID_USER_MODE' })
    }
    patch.userMode = input.userMode
  }
  if (Object.prototype.hasOwnProperty.call(input, 'onboardingComplete')) {
    patch.onboardingComplete = input.onboardingComplete === true
  }
  if (Object.prototype.hasOwnProperty.call(input, 'vehicle')) {
    patch.vehicle = sanitizeVehicle(input.vehicle)
  }
  if (Object.prototype.hasOwnProperty.call(input, 'preference')) {
    patch.preference = sanitizePreference(input.preference)
  }
  if (Object.prototype.hasOwnProperty.call(input, 'habitTags')) {
    patch.habitTags = Array.isArray(input.habitTags)
      ? input.habitTags.slice(0, 10).map((item) => cleanString(item, 30)).filter(Boolean)
      : []
  }
  return patch
}

function sanitizeUser(user) {
  if (!user) return null
  const { _id, _openid, lastWechatOpenId, ...safe } = user
  return safe
}

async function findUser(accountId) {
  const response = await users.where({ openId: accountId }).limit(1).get()
  return response.data[0] || null
}

async function createOrUpdate(accountId, patch) {
  const existing = await findUser(accountId)
  const now = db.serverDate()
  if (existing) {
    const update = { ...patch, updatedAt: now }
    if (Object.prototype.hasOwnProperty.call(patch, 'vehicle')) {
      update.vehicle = _.set(patch.vehicle)
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'preference')) {
      update.preference = _.set(patch.preference)
    }
    await users.doc(existing._id).update({ data: update })
  } else {
    await users.add({
      data: {
        openId: accountId,
        email: '',
        emailVerified: false,
        emailVerificationMode: '',
        displayName: '',
        nickName: '',
        avatarUrl: '',
        phone: '',
        department: '',
        identities: [],
        onboardingComplete: false,
        userMode: 'owner',
        vehicle: null,
        preference: null,
        habitTags: [],
        lastWechatOpenId: '',
        ...patch,
        createdAt: now,
        updatedAt: now
      }
    })
  }
  return sanitizeUser(await findUser(accountId))
}

async function resolveSessionUser(wechatOpenId) {
  return findUserByWechatOpenId(users, wechatOpenId)
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return failure('NOT_AUTHENTICATED', '无法识别当前用户')

    const action = event && event.action
    if (action === 'get') {
      const sessionUser = await resolveSessionUser(OPENID)
      return result(sanitizeUser(sessionUser))
    }

    if (action === 'bindMockEmail') {
      const email = normalizeEmail(event.email)
      const accountId = emailToAccountId(email)
      const existing = await findUserByEmail(users, email)
      const stableAccountId = existing && existing.openId ? existing.openId : accountId

      return result(await createOrUpdate(stableAccountId, {
        openId: stableAccountId,
        email,
        emailVerified: false,
        emailVerificationMode: 'mock',
        displayName: cleanString(event.displayName, 40) || email.split('@')[0],
        nickName: cleanString(event.displayName, 40) || email.split('@')[0],
        lastWechatOpenId: OPENID
      }))
    }

    if (action === 'updateProfile') {
      const sessionUser = await resolveSessionUser(OPENID)
      if (!sessionUser || !sessionUser.openId) {
        return failure('NOT_LOGGED_IN', '请先完成邮箱登录')
      }
      return result(await createOrUpdate(sessionUser.openId, {
        ...sanitizePatch(event.patch || {}),
        lastWechatOpenId: OPENID
      }))
    }

    return failure('INVALID_ACTION', '不支持的用户操作')
  } catch (error) {
    const known = ['INVALID_EMAIL', 'INVALID_USER_MODE']
    if (known.includes(error && error.code)) {
      return failure(error.code, '提交的用户资料无效')
    }
    console.error('[user] failed', {
      name: error && error.name,
      code: error && (error.code || error.errCode),
      message: error && error.message
    })
    return failure('USER_SERVICE_FAILED', '用户服务暂时不可用')
  }
}
