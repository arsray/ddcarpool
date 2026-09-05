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
    // SECURITY-REVIEW: 云函数参数均视为不可信输入，服务端必须再次校验并从微信上下文取身份。
    const response = await Promise.race([
      wx.cloud.callFunction({ name, data: data || {} }),
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
