/**
 * M1 SMTP 交付接口。
 * M1 应只替换本函数内部实现，凭据必须读取云函数环境变量。
 */
async function sendVerificationEmail() {
  const error = new Error('SMTP_NOT_CONFIGURED')
  error.code = 'SMTP_NOT_CONFIGURED'
  throw error
}

module.exports = {
  sendVerificationEmail
}
