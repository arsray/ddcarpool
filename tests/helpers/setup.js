/**
 * 测试公共工具 — Mock wx、账号、订单模块加载
 */

const path = require('node:path')
const { createMockWx } = require('../mock-wx')

const ALICE = {
  email: 'alice.passenger@disney.com',
  openId: 'mock_alice_passenger_disney_com',
  name: 'Alice'
}

const BOB = {
  email: 'bob.driver@disney.com',
  openId: 'mock_bob_driver_disney_com',
  name: 'Bob'
}

function futureDepartWindow(daysAhead = 1, hour = 10) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setHours(hour, 0, 0, 0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(hour).padStart(2, '0')
  const endHour = hour
  const endMin = 15
  return {
    departTime: `${y}-${m}-${day} ${hh}:00`,
    departTimeEnd: `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`
  }
}

function buildCreateInput(overrides = {}) {
  const slot = futureDepartWindow()
  return {
    fromPointId: 'poi-01',
    toPointId: 'poi-08',
    departTime: slot.departTime,
    departTimeEnd: slot.departTimeEnd,
    passengerCount: 1,
    passengerOpenId: ALICE.openId,
    passengerName: ALICE.name,
    note: '',
    ...overrides
  }
}

function loadModule(relativePath) {
  const abs = path.join(__dirname, '../../miniprogram', relativePath)
  delete require.cache[require.resolve(abs)]
  return require(abs)
}

async function withMockWx(initialStorage, fn) {
  const mockWx = createMockWx(initialStorage)
  global.wx = mockWx
  try {
    return await fn(mockWx)
  } finally {
    delete global.wx
  }
}

async function withOrderModule(initialStorage, fn) {
  return withMockWx(initialStorage || { m3_orders_v1: [], notifications: [] }, async (mockWx) => {
    const order = loadModule('modules/order/index.js')
    return fn({ order, mockWx })
  })
}

function withAuthStore(initialStorage, fn) {
  return withMockWx(initialStorage || {}, (mockWx) => {
    const store = loadModule('modules/auth/store.js')
    store.initFromStorage()
    return fn({ store, mockWx })
  })
}

function simulatePassengerOnboarding(store) {
  store.addIdentity('passenger')
  store.savePreference({ defaultCount: 1, noteTags: ['携带大件行李'], note: '' })
  store.completeOnboarding()
}

function simulateOwnerOnboarding(store) {
  store.addIdentity('owner')
  store.saveVehicle({
    brand: '特斯拉',
    modelType: 'SUV',
    plate: '沪A12345',
    passengerCapacity: 4,
    color: '白色'
  })
  store.completeOnboarding()
}

module.exports = {
  ALICE,
  BOB,
  futureDepartWindow,
  buildCreateInput,
  loadModule,
  withMockWx,
  withOrderModule,
  withAuthStore,
  simulatePassengerOnboarding,
  simulateOwnerOnboarding
}
