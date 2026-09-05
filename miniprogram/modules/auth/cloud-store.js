const { callFunction } = require('../../utils/cloud')
const { normalizeEmail } = require('./email')
const { safeReLaunch, safeSwitchTab } = require('./nav')
const config = require('../../config/index')

const CACHE_KEY = 'cloudUserCache'
const state = {
  openId: null,
  emailVerified: false,
  emailVerificationMode: '',
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

function applyUser(openId, user) {
  state.openId = openId || (user && user.openId) || null
  if (!user) {
    state.userInfo = null
    return state
  }
  state.emailVerified = user.emailVerified === true
  state.emailVerificationMode = user.emailVerificationMode || ''
  state.userInfo = {
    email: user.email || '',
    displayName: user.displayName || user.nickName || '',
    phone: user.phone || '',
    department: user.department || '',
    avatarUrl: user.avatarUrl || ''
  }
  state.identities = Array.isArray(user.identities) ? user.identities : []
  state.onboardingComplete = user.onboardingComplete === true
  state.userMode = user.userMode || 'owner'
  state.vehicle = user.vehicle || null
  state.preference = user.preference || null
  state.habitTags = Array.isArray(user.habitTags) ? user.habitTags : []
  wx.setStorageSync(CACHE_KEY, { openId: state.openId, user })
  wx.setStorageSync('loggedIn', true)
  return state
}

function initFromStorage() {
  const cached = wx.getStorageSync(CACHE_KEY)
  if (cached && cached.openId && cached.user) {
    applyUser(cached.openId, cached.user)
  }
  return state
}

async function bootstrapCloudSession() {
  const session = await callFunction('login')
  if (session && session.user) applyUser(session.openId, session.user)
  else state.openId = session && session.openId ? session.openId : null
  return state
}

function isLoggedIn() {
  return Boolean(
    state.openId &&
    state.userInfo &&
    (state.emailVerified || config.allowMockEmailVerification)
  )
}

function getOpenId() {
  return state.openId
}

function getUserProfile() {
  if (!state.userInfo) return null
  return {
    openId: state.openId,
    nickName: state.userInfo.displayName,
    avatarUrl: state.userInfo.avatarUrl || '',
    department: state.userInfo.department || '',
    email: state.userInfo.email || '',
    emailVerified: state.emailVerified,
    emailVerificationMode: state.emailVerificationMode
  }
}

function setNotifications(notifications) {
  state.notifications = Array.isArray(notifications) ? notifications : []
  return state.notifications
}

function syncGlobalData(globalData) {
  globalData.openId = state.openId
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

async function loginWithEmail(email, verificationMode) {
  const normalized = normalizeEmail(email)
  const session = await callFunction('login')
  if (verificationMode === 'smtp') {
    const refreshed = await callFunction('login')
    if (!refreshed.user || refreshed.user.email !== normalized || !refreshed.user.emailVerified) {
      const error = new Error('EMAIL_NOT_VERIFIED')
      error.code = 'EMAIL_NOT_VERIFIED'
      throw error
    }
    applyUser(refreshed.openId, refreshed.user)
    return state
  }
  if (!config.allowMockEmailVerification) {
    const error = new Error('MOCK_EMAIL_DISABLED')
    error.code = 'MOCK_EMAIL_DISABLED'
    throw error
  }
  const user = await callFunction('user', {
    action: 'bindMockEmail',
    email: normalized,
    displayName: normalized.split('@')[0]
  })
  applyUser(session.openId, user)
  return state
}

async function refreshUser() {
  const user = await callFunction('user', { action: 'get' })
  if (user) applyUser(state.openId, user)
  return state
}

async function updateProfile(patch) {
  const user = await callFunction('user', { action: 'updateProfile', patch })
  applyUser(state.openId, user)
  return user
}

function routeAfterLogin() {
  if (!state.onboardingComplete || !state.identities.length) {
    safeReLaunch('/pages/onboarding/identity/identity')
    return
  }
  safeSwitchTab('/pages/mine/mine')
}

function logout() {
  wx.removeStorageSync(CACHE_KEY)
  wx.removeStorageSync('loggedIn')
  Object.assign(state, {
    openId: null,
    emailVerified: false,
    emailVerificationMode: '',
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
  if (!state.identities.includes(mode)) return Promise.resolve(null)
  return updateProfile({ userMode: mode })
}

function addIdentity(role) {
  if (!['owner', 'passenger'].includes(role)) return Promise.resolve(null)
  const identities = Array.from(new Set([...state.identities, role]))
  return updateProfile({ identities, userMode: role })
}

function completeOnboarding() {
  return updateProfile({ onboardingComplete: true })
}

function saveVehicle(vehicle) {
  return updateProfile({ vehicle })
}

function savePreference(preference) {
  return updateProfile({ preference })
}

function getPreference() {
  return state.preference
}

function saveHabitTags(habitTags) {
  return updateProfile({ habitTags })
}

function hasIdentity(role) {
  return state.identities.includes(role)
}

function getMissingIdentity() {
  if (!state.identities.includes('owner')) return 'owner'
  if (!state.identities.includes('passenger')) return 'passenger'
  return null
}

function getMockTestUsers() {
  return []
}

function switchMockUser() {
  const error = new Error('MOCK_USERS_DISABLED')
  error.code = 'MOCK_USERS_DISABLED'
  throw error
}

module.exports = {
  initFromStorage,
  bootstrapCloudSession,
  refreshUser,
  setNotifications,
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
  switchMockUser
}
