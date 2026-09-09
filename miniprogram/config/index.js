/**
 * 运行时配置。
 * 本地 env.js 已被 gitignore；缺失时使用安全默认值。
 */
let local = {}

const isNodeTest =
  typeof process !== 'undefined' &&
  process.env &&
  process.env.DD_CARPOOL_TEST === '1'

try {
  local = isNodeTest ? { useCloud: false, cloudEnvId: '' } : require('./env.js')
} catch (error) {
  local = {}
}

const cloudEnvId = typeof local.cloudEnvId === 'string' ? local.cloudEnvId.trim() : ''
const useCloud = Boolean(cloudEnvId && local.useCloud !== false)
const environment = local.environment === 'trial' || local.environment === 'production'
  ? local.environment
  : 'development'

module.exports = {
  cloudEnvId,
  useCloud,
  environment,
  allowMockEmailVerification: Boolean(
    environment === 'development' && local.allowMockEmailVerification !== false
  )
}
