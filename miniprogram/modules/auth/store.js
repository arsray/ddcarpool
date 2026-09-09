/**
 * M1 预览态会话存储（Mock 阶段）
 * 正式接入云开发后，openId / userProfile 以云函数 login 为准
 */
const { normalizeEmail } = require('./email')
const { MOCK } = require('./mock')
const {
  SNAPSHOT_STORAGE_KEY,
  findMockTestUser,
  presetToSnapshot,
  getMockTestUsers
} = require('./mock-users')
const { safeReLaunch, safeSwitchTab } = require('./nav')
const { clearAllUserStorage } = require('./clear-storage')
const {
  writeSession,
  clearSession,
  isSessionValid,
  SESSION_TTL_MS
} = require('./session')

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

/** 合并 M3 本地订单到历史列表（无写死种子单） */
function mergePassengerOrders(userInfo) {
  try {
    const openId = mockOpenId(userInfo && userInfo.email)
    if (!openId) return []
    const { getPassengerHistoryItems } = require('../order/service')
    return getPassengerHistoryItems(openId)
  } catch (e) {
    return []
  }
}

function mergeOwnerOrders(userInfo) {
  try {
    const openId = mockOpenId(userInfo && userInfo.email)
    if (!openId) return []
    const { getDriverHistoryItems } = require('../order/service')
    return getDriverHistoryItems(openId)
  } catch (e) {
    return []
  }
}

function initFromStorage() {
  const s = getState()

  if (!isSessionValid()) {
    s.userInfo = null
    s.identities = []
    s.onboardingComplete = false
    s.userMode = 'owner'
    s.vehicle = null
    s.preference = null
    s.habitTags = []
    s.historyOwner = []
    s.historyPassenger = []
    s.notifications = []
    return s
  }

  const loggedIn = wx.getStorageSync('loggedIn')
  if (!loggedIn) return s

  s.userInfo = wx.getStorageSync('userInfo') || MOCK.userInfo
  s.identities = wx.getStorageSync('identities') || []
  s.onboardingComplete = wx.getStorageSync('onboardingComplete') || false
  s.userMode = wx.getStorageSync('userMode') || 'owner'
  s.vehicle = wx.getStorageSync('vehicle') || null
  s.preference = wx.getStorageSync('preference') || null
  if (s.preference && !s.preference.noteTags) {
    s.preference = {
      defaultCount: s.preference.defaultCount || 1,
      noteTags: s.preference.note ? [s.preference.note] : [],
      note: ''
    }
    wx.setStorageSync('preference', s.preference)
  }
  s.habitTags = wx.getStorageSync('habitTags') || []

  s.historyOwner = mergeOwnerOrders(s.userInfo)
  s.historyPassenger = mergePassengerOrders(s.userInfo)
  s.notifications = wx.getStorageSync('notifications') || []

  if (!s.identities.length && s.onboardingComplete === false && s.vehicle) {
    s.identities = ['owner']
    s.onboardingComplete = true
    wx.setStorageSync('identities', s.identities)
    wx.setStorageSync('onboardingComplete', true)
  }

  return s
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
  if (!isSessionValid()) return false
  return !!state.userInfo
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
  const snapshots = readUserSnapshots()
  const stored = wx.getStorageSync('userInfo')
  const isReturning = stored && stored.email === normalized

  if (snapshots[normalized]) {
    applyUserSnapshot(snapshots[normalized])
    writeSession(normalized)
    initFromStorage()
    return
  }

  if (isReturning) {
    writeSession(normalized)
    initFromStorage()
    return
  }

  clearAllUserStorage()

  const userInfo = {
    email: normalized,
    displayName: normalized.split('@')[0],
    phone: '',
    department: ''
  }

  wx.setStorageSync('userInfo', userInfo)
  writeSession(normalized)
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
  saveCurrentUserSnapshot()
  clearSession()
  clearAllUserStorage()
  Object.assign(state, {
    openId: null,
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
  })
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

function getPreference() {
  const stored = wx.getStorageSync('preference')
  if (stored && typeof stored === 'object') {
    state.preference = stored
    return stored
  }
  return state.preference
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

function readUserSnapshots() {
  return wx.getStorageSync(SNAPSHOT_STORAGE_KEY) || {}
}

function writeUserSnapshots(snapshots) {
  wx.setStorageSync(SNAPSHOT_STORAGE_KEY, snapshots)
}

function saveCurrentUserSnapshot() {
  const email = state.userInfo && state.userInfo.email
  if (!email) return

  const snapshots = readUserSnapshots()
  snapshots[email] = {
    userInfo: wx.getStorageSync('userInfo') || state.userInfo,
    identities: wx.getStorageSync('identities') || [],
    onboardingComplete: !!wx.getStorageSync('onboardingComplete'),
    userMode: wx.getStorageSync('userMode') || 'owner',
    vehicle: wx.getStorageSync('vehicle') || null,
    preference: wx.getStorageSync('preference') || null,
    habitTags: wx.getStorageSync('habitTags') || [],
    notifications: wx.getStorageSync('notifications') || []
  }
  writeUserSnapshots(snapshots)
}

function applyUserSnapshot(snapshot) {
  wx.setStorageSync('userInfo', snapshot.userInfo)
  writeSession(snapshot.userInfo && snapshot.userInfo.email)
  wx.setStorageSync('identities', snapshot.identities || [])
  wx.setStorageSync('onboardingComplete', !!snapshot.onboardingComplete)
  wx.setStorageSync('userMode', snapshot.userMode || 'owner')

  if (snapshot.vehicle) {
    wx.setStorageSync('vehicle', snapshot.vehicle)
  } else {
    wx.removeStorageSync('vehicle')
  }

  if (snapshot.preference) {
    wx.setStorageSync('preference', snapshot.preference)
  } else {
    wx.removeStorageSync('preference')
  }

  if (snapshot.habitTags && snapshot.habitTags.length) {
    wx.setStorageSync('habitTags', snapshot.habitTags)
  } else {
    wx.removeStorageSync('habitTags')
  }

  wx.setStorageSync('notifications', snapshot.notifications || [])
}

function switchMockUser(email) {
  const normalized = normalizeEmail(email)
  const preset = findMockTestUser(normalized)
  if (!preset) {
    const err = new Error('MOCK_USER_NOT_FOUND')
    err.code = 'MOCK_USER_NOT_FOUND'
    throw err
  }

  saveCurrentUserSnapshot()

  const snapshots = readUserSnapshots()
  const snapshot = snapshots[normalized] || presetToSnapshot(preset)
  applyUserSnapshot(snapshot)
  initFromStorage()
  return preset
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
  getPreference,
  saveHabitTags,
  hasIdentity,
  getMissingIdentity,
  getMockTestUsers,
  switchMockUser,
  SESSION_TTL_MS
}
