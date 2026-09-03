// SECURITY-REVIEW: 邮箱验证码属于敏感认证数据；仅保存摘要并限制频率与尝试次数。
const crypto = require('crypto')
const cloud = require('wx-server-sdk')
const { sendVerificationEmail } = require('./smtp-adapter')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const verifications = db.collection('email_verifications')
const users = db.collection('users')
const TTL_MS = 10 * 60 * 1000
const COOLDOWN_MS = 60 * 1000
const MAX_ATTEMPTS = 5

function success(data) {
  return { ok: true, data }
}

function failure(code, message) {
  return { ok: false, code, message }
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  if (!/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?@disney\.com$/.test(email)) {
    throw Object.assign(new Error('INVALID_EMAIL'), { code: 'INVALID_EMAIL' })
  }
  return email
}

function pepper() {
  const value = process.env.EMAIL_CODE_PEPPER
  if (!value || value.length < 32) {
    throw Object.assign(new Error('EMAIL_AUTH_NOT_CONFIGURED'), {
      code: 'EMAIL_AUTH_NOT_CONFIGURED'
    })
  }
  return value
}

function digest(openId, email, code) {
  return crypto
    .createHmac('sha256', pepper())
    .update(`${openId}:${email}:${code}`)
    .digest('hex')
}

function generateCode() {
  return String(crypto.randomInt(100000, 1000000))
}

async function latestRecord(openId, email) {
  const response = await verifications
    .where({ openId, emailNormalized: email, used: false })
    .orderBy('createdAtMs', 'desc')
    .limit(1)
    .get()
  return response.data[0] || null
}

async function requestCode(openId, email) {
  pepper()
  const now = Date.now()
  const [openidRecent, emailRecent] = await Promise.all([
    verifications.where({
      openId,
      createdAtMs: _.gt(now - COOLDOWN_MS)
    }).limit(1).get(),
    verifications.where({
      emailNormalized: email,
      createdAtMs: _.gt(now - COOLDOWN_MS)
    }).limit(1).get()
  ])
  if (openidRecent.data.length || emailRecent.data.length) {
    return failure('EMAIL_CODE_COOLDOWN', '验证码发送过于频繁，请稍后重试')
  }

  const code = generateCode()
  await sendVerificationEmail({ email, code, expiresInMinutes: TTL_MS / 60000 })

  await verifications.add({
    data: {
      openId,
      emailNormalized: email,
      codeDigest: digest(openId, email, code),
      createdAtMs: now,
      expiresAtMs: now + TTL_MS,
      attempts: 0,
      used: false,
      createdAt: db.serverDate()
    }
  })
  return success({ expiresInSeconds: TTL_MS / 1000, cooldownSeconds: COOLDOWN_MS / 1000 })
}

async function verifyCode(openId, email, code) {
  const record = await latestRecord(openId, email)
  const now = Date.now()
  if (!record || record.expiresAtMs <= now || record.used) {
    return failure('EMAIL_CODE_INVALID', '验证码无效或已过期')
  }
  if (record.attempts >= MAX_ATTEMPTS) {
    return failure('EMAIL_CODE_LOCKED', '验证码尝试次数过多，请重新获取')
  }

  const supplied = digest(openId, email, String(code || '').trim())
  const expectedBuffer = Buffer.from(record.codeDigest, 'hex')
  const suppliedBuffer = Buffer.from(supplied, 'hex')
  if (
    expectedBuffer.length !== suppliedBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, suppliedBuffer)
  ) {
    await verifications.doc(record._id).update({ data: { attempts: _.inc(1) } })
    return failure('EMAIL_CODE_INVALID', '验证码无效或已过期')
  }

  const alreadyBound = await users.where({
    email,
    emailVerified: true,
    openId: _.neq(openId)
  }).limit(1).get()
  if (alreadyBound.data.length) {
    return failure('EMAIL_BIND_FAILED', '邮箱绑定失败，请联系管理员')
  }

  const existing = await users.where({ openId }).limit(1).get()
  const user = existing.data[0]
  const update = {
    email,
    emailVerified: true,
    emailVerificationMode: 'smtp',
    updatedAt: db.serverDate()
  }
  if (user) {
    await users.doc(user._id).update({ data: update })
  } else {
    await users.add({
      data: {
        openId,
        displayName: email.split('@')[0],
        nickName: email.split('@')[0],
        identities: [],
        onboardingComplete: false,
        userMode: 'owner',
        ...update,
        createdAt: db.serverDate()
      }
    })
  }
  await verifications.doc(record._id).update({
    data: { used: true, usedAt: db.serverDate() }
  })
  return success({ emailVerified: true })
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return failure('NOT_AUTHENTICATED', '无法识别当前用户')
    const email = normalizeEmail(event && event.email)
    if (event.action === 'requestCode') return requestCode(OPENID, email)
    if (event.action === 'verifyCode') {
      return verifyCode(OPENID, email, event.code)
    }
    return failure('INVALID_ACTION', '不支持的邮箱验证操作')
  } catch (error) {
    if (error && error.code === 'SMTP_NOT_CONFIGURED') {
      return failure('SMTP_NOT_CONFIGURED', '邮件服务尚未配置')
    }
    if (error && ['INVALID_EMAIL', 'EMAIL_AUTH_NOT_CONFIGURED'].includes(error.code)) {
      return failure(error.code, '邮箱验证服务尚不可用')
    }
    console.error('[emailAuth] failed', { name: error && error.name })
    return failure('EMAIL_AUTH_FAILED', '邮箱验证服务暂时不可用')
  }
}
