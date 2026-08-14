/**
 * M1 预览态会话存储（Mock 阶段）
 * 正式接入云开发后，openId / userProfile 以云函数 login 为准
 */
const { normalizeEmail } = require('./email')
const { MOCK, MOCK_SEED_VERSION, cloneSeedOrders } = require('./mock')
const { safeReLaunch, safeSwitchTab } = require('./nav')

function mockOpenId(email) {
  const normalized = normalizeEmail(email || '')
  return normalized ? `mock_${normalized.replace(/[^a-z0-9]/g, '_')}` : null
}

function toUserProfile(userInfo) {
  if (!userInfo) return null
  return {
    openId: mockOpenId(userInfo.email),
    nickName: userInfo.displayName || '',
    avatarUrl: userInfo.avatarUrl || '',
    department: userInfo.department || '',
    email: userInfo.email || ''
  }
}

/** 每次启动写入固定测试订单，避免本地空缓存覆盖 Mock */
function applyPreviewSeedOrders() {
  const seed = cloneSeedOrders()
  wx.setStorageSync('mockSeedVersion', MOCK_SEED_VERSION)
  wx.setStorageSync('historyOwner', seed.historyOwner)
  wx.setStorageSync('historyPassenger', seed.historyPassenger)
  wx.setStorageSync('notifications', seed.notifications)
  return seed
}

function initFromStorage() {
  const loggedIn = wx.getStorageSync('loggedIn')
  if (!loggedIn) return getState()

  const state = getState()
  state.userInfo = wx.getStorageSync('userInfo') || MOCK.userInfo
  state.identities = wx.getStorageSync('identities') || []
  state.onboardingComplete = wx.getStorageSync('onboardingComplete') || false
  state.userMode = wx.getStorageSync('userMode') || 'owner'
  state.vehicle = wx.getStorageSync('vehicle') || null
  state.preference = wx.getStorageSync('preference') || null
  if (state.preference && !state.preference.noteTags) {
    state.preference = {
      defaultCount: state.preference.defaultCount || 1,
      noteTags: state.preference.note ? [state.preference.note] : [],
      note: ''
    }
    wx.setStorageSync('preference', state.preference)
  }
  state.habitTags = wx.getStorageSync('habitTags') || []

  const seed = applyPreviewSeedOrders()
  state.historyOwner = seed.historyOwner
  state.historyPassenger = seed.historyPassenger
  state.notifications = seed.notifications

  if (!state.identities.length && state.onboardingComplete === false && state.vehicle) {
    state.identities = ['owner']
    state.onboardingComplete = true
    wx.setStorageSync('identities', state.identities)
    wx.setStorageSync('onboardingComplete', true)
  }

  return state
}

const state = {
  userInfo: null,
  identities: [],
  onboardingComplete: false,
  userMode: 'owner',
  vehicle: null,
  preference: null,
  habitTags: [],
  historyOwner: [],
  historyPassenger: [],
  notifications: []
}

function getState() {
  return state
}

function isLoggedIn() {
  return !!wx.getStorageSync('loggedIn') && !!state.userInfo
}

function getOpenId() {
  if (!isLoggedIn()) return null
  return mockOpenId(state.userInfo.email)
}

function getUserProfile() {
  return toUserProfile(state.userInfo)
}

function syncGlobalData(globalData) {
  globalData.openId = getOpenId()
  globalData.userProfile = getUserProfile()
  globalData.userMode = state.userMode
  globalData.userInfo = state.userInfo
  globalData.identities = state.identities
  globalData.onboardingComplete = state.onboardingComplete
  globalData.vehicle = state.vehicle
  globalData.preference = state.preference
  globalData.habitTags = state.habitTags
  globalData.historyOwner = state.historyOwner
  globalData.historyPassenger = state.historyPassenger
  globalData.notifications = state.notifications
}

function loginWithEmail(email) {
  const normalized = normalizeEmail(email)
  const stored = wx.getStorageSync('userInfo')
  const isReturning = stored && stored.email === normalized

  if (isReturning) {
    wx.setStorageSync('loggedIn', true)
    initFromStorage()
    return
  }

  const userInfo = {
    email: normalized,
    displayName: normalized.split('@')[0],
    phone: '',
    department: ''
  }

  wx.setStorageSync('loggedIn', true)
  wx.setStorageSync('userInfo', userInfo)
  wx.setStorageSync('identities', [])
  wx.setStorageSync('onboardingComplete', false)
  wx.setStorageSync('userMode', 'owner')
  wx.removeStorageSync('vehicle')
  wx.removeStorageSync('preference')
  wx.removeStorageSync('habitTags')

  initFromStorage()
}

function routeAfterLogin() {
  if (!state.onboardingComplete || !state.identities.length) {
    safeReLaunch('/pages/onboarding/identity/identity')
    return
  }
  safeSwitchTab('/pages/mine/mine')
}

function logout() {
  wx.removeStorageSync('loggedIn')
  wx.removeStorageSync('userInfo')
  state.userInfo = null
  state.identities = []
  state.onboardingComplete = false
}

function setUserMode(mode) {
  if (!state.identities.includes(mode)) return
  state.userMode = mode
  wx.setStorageSync('userMode', mode)
}

function addIdentity(role) {
  const ids = state.identities.slice()
  if (!ids.includes(role)) {
    ids.push(role)
    state.identities = ids
    wx.setStorageSync('identities', ids)
  }
  state.userMode = role
  wx.setStorageSync('userMode', role)
}

function completeOnboarding() {
  state.onboardingComplete = true
  wx.setStorageSync('onboardingComplete', true)
}

function saveVehicle(vehicle) {
  state.vehicle = vehicle
  wx.setStorageSync('vehicle', vehicle)
}

function savePreference(preference) {
  state.preference = preference
  wx.setStorageSync('preference', preference)
}

function saveHabitTags(tags) {
  state.habitTags = tags
  wx.setStorageSync('habitTags', tags)
}

function hasIdentity(role) {
  return state.identities.includes(role)
}

function getMissingIdentity() {
  const ids = state.identities || []
  if (!ids.includes('owner')) return 'owner'
  if (!ids.includes('passenger')) return 'passenger'
  return null
}

module.exports = {
  initFromStorage,
  getState,
  isLoggedIn,
  getOpenId,
  getUserProfile,
  syncGlobalData,
  loginWithEmail,
  routeAfterLogin,
  logout,
  setUserMode,
  addIdentity,
  completeOnboarding,
  saveVehicle,
  savePreference,
  saveHabitTags,
  hasIdentity,
  getMissingIdentity,
  applyPreviewSeedOrders
}
