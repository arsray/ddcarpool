/**
 * 跨页面通用工具（登录守卫等）
 * 委托 M1 auth 模块，供 scaffold 页面沿用 ../../utils/util 路径
 */
const auth = require('../modules/auth/index')

function requireLogin() {
  return auth.requireLogin()
}

module.exports = {
  requireLogin
}
