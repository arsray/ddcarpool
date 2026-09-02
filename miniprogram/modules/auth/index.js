/**
 * M1 — auth 模块
 * 接口契约见 docs/MODULE_CONTRACTS.md
 */
const config = require('../../config/index')
const store = config.useCloud ? require('./cloud-store') : require('./store')
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
  let openId = store.getOpenId()
  if (!openId && config.useCloud && store.bootstrapCloudSession) {
    await store.bootstrapCloudSession()
    openId = store.getOpenId()
    try {
      const app = getApp()
      if (app && app._syncAuth) app._syncAuth()
    } catch (error) {
      // App 尚未就绪时仅返回身份。
    }
  }
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
  if (config.useCloud && store.refreshUser) await store.refreshUser()
  try {
    const app = getApp()
    if (app && app._syncAuth) app._syncAuth()
  } catch (error) {
    // App 尚未就绪时返回 store 中的最新值。
  }
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
  const openId = await ensureLogin()
  if (config.useCloud) {
    const order = require('../order/index')
    const [passenger, driver] = await Promise.all([
      order.listOrdersForUser(openId, { role: 'passenger' }),
      order.listOrdersForUser(openId, { role: 'driver' })
    ])
    return [...passenger, ...driver]
  }
  store.initFromStorage()
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
