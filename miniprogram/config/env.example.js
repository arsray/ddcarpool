/**
 * 本地环境配置示例
 * 复制本文件为 env.js 并填入实际值（env.js 已在 .gitignore 中）
 */
module.exports = {
  cloudEnvId: 'YOUR_CLOUD_ENV_ID',
  useCloud: true,
  environment: 'development',
  // 仅开发者工具临时使用；trial / production 会被强制关闭。
  allowMockEmailVerification: false
}
