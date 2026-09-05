/**
 * 本地环境配置（不提交 Git，每人自行维护 miniprogram/config/env.js）
 *
 * 1. 复制本文件为 env.js
 * 2. cloudEnvId 向 Ray / M1 索取团队共用开发环境 ID（形如 cloudbase-xxx）
 * 3. 日常开发默认 useCloud: true；仅离线改 UI 时可临时 false，PR 合并前必须在 Cloud 验通
 *
 * 详见 docs/CLOUD_DEPLOYMENT.md、docs/M3_PR_REVIEW_RESPONSE.md § 开发约定
 */
module.exports = {
  cloudEnvId: 'YOUR_CLOUD_ENV_ID',
  useCloud: true,
  environment: 'development',
  // development 下允许邮箱验证码预览；trial / production 会被强制关闭
  allowMockEmailVerification: true
}
