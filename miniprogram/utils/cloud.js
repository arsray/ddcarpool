const config = require('../config/index')

const DEFAULT_TIMEOUT_MS = 15000

function makeError(code, message) {
  const error = new Error(message || code)
  error.code = code
  return error
}

function isCloudEnabled() {
  return Boolean(config.useCloud && wx.cloud)
}

function getClientAccountId() {
  try {
    const { getSessionAccountId, readSession } = require('../modules/auth/session')
    const fromSession = getSessionAccountId()
    if (fromSession) return fromSession
    const session = readSession()
    if (session && session.email) {
      const { emailToAccountId } = require('../modules/auth/email')
      return emailToAccountId(session.email)
    }
  } catch (error) {
    // App 未加载 session 模块时忽略
  }
  try {
    const cache = wx.getStorageSync('cloudUserCache')
    const userInfo = wx.getStorageSync('userInfo')
    if (cache && cache.openId && userInfo && userInfo.email) {
      const session = wx.getStorageSync('authSession')
      if (session && session.email && userInfo.email === session.email) {
        return String(cache.openId).trim()
      }
    }
  } catch (error) {
    // ignore
  }
  return ''
}

async function callFunction(name, data, options) {
  if (!isCloudEnabled()) {
    throw makeError('CLOUD_DISABLED', '云服务尚未启用')
  }

  const timeoutMs = options && options.timeoutMs
    ? options.timeoutMs
    : DEFAULT_TIMEOUT_MS

  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(makeError('CLOUD_TIMEOUT', '云服务响应超时，请稍后重试'))
    }, timeoutMs)
  })

  try {
    const accountId = getClientAccountId()
    const payload = { ...(data || {}) }
    if (accountId && payload.accountId == null) {
      payload.accountId = accountId
    }
    // SECURITY-REVIEW: accountId 不可信；云函数须用 OPENID + lastWechatOpenId 绑定校验。
    const response = await Promise.race([
      wx.cloud.callFunction({ name, data: payload }),
      timeout
    ])
    const result = response && response.result
    if (!result || result.ok !== true) {
      throw makeError(
        (result && result.code) || 'CLOUD_CALL_FAILED',
        (result && result.message) || '云服务调用失败'
      )
    }
    return result.data
  } catch (error) {
    if (error && error.code) throw error
    const detail = error && error.errMsg ? String(error.errMsg) : ''
    throw makeError(
      'CLOUD_CALL_FAILED',
      detail ? `云服务调用失败（${name}）：${detail}` : `云服务调用失败（${name}）`
    )
  } finally {
    clearTimeout(timer)
  }
}

module.exports = {
  callFunction,
  isCloudEnabled,
  makeError
}
