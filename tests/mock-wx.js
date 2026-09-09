/**
 * 内存版 wx.storage，供 Node 下跑 order 模块集成测试
 */

function createMockWx(initial = {}) {
  const store = { ...initial }

  return {
    getStorageSync(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : ''
    },
    setStorageSync(key, value) {
      store[key] = value
    },
    removeStorageSync(key) {
      delete store[key]
    },
    _dump() {
      return { ...store }
    },
    _reset(next = {}) {
      Object.keys(store).forEach((key) => delete store[key])
      Object.assign(store, next)
    }
  }
}

module.exports = { createMockWx }
