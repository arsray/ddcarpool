/**
 * M1 — auth 模块
 * 接口契约见 docs/MODULE_CONTRACTS.md
 */

function notImplemented(name) {
  const err = new Error(`${name} not implemented — M1 owner`)
  err.code = 'NOT_IMPLEMENTED'
  throw err
}

async function ensureLogin() {
  notImplemented('ensureLogin')
}

async function getProfile() {
  notImplemented('getProfile')
}

async function requestProfile() {
  notImplemented('requestProfile')
}

async function listMyOrders() {
  notImplemented('listMyOrders')
}

module.exports = {
  ensureLogin,
  getProfile,
  requestProfile,
  listMyOrders
}
