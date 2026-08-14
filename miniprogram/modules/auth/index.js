/**
 * M1 — auth 模块
 * 接口契约见 docs/MODULE_CONTRACTS.md
 */
const store = require('./store')
const { listMyOrdersFromStore } = require('./mapper')
const { statusActions, isDangerAction } = require('./order-actions')
const { safeReLaunch } = require('./nav')

function requireLogin() {
  store.initFromStorage()
  try {
    const app = getApp()
    if (app && app._syncAuth) app._syncAuth()
  } catch (e) {
    // getApp 在 App 未就绪时可能失败
  }
  if (!store.isLoggedIn()) {
    safeReLaunch('/pages/login/login')
    return false
  }
  return true
}

async function ensureLogin() {
  store.initFromStorage()
  const openId = store.getOpenId()
  if (!openId) {
    safeReLaunch('/pages/login/login')
    const err = new Error('NOT_LOGGED_IN')
    err.code = 'NOT_LOGGED_IN'
    throw err
  }
  return openId
}

async function getProfile() {
  store.initFromStorage()
  return store.getUserProfile()
}

async function requestProfile() {
  const profile = await getProfile()
  if (profile) return profile
  const err = new Error('PROFILE_NOT_FOUND')
  err.code = 'PROFILE_NOT_FOUND'
  throw err
}

async function listMyOrders() {
  store.initFromStorage()
  await ensureLogin()
  return listMyOrdersFromStore(store)
}

module.exports = {
  ensureLogin,
  getProfile,
  requestProfile,
  listMyOrders,
  requireLogin,
  statusActions,
  isDangerAction,
  store
}
