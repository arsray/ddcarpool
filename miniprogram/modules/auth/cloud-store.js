const { callFunction } = require('../../utils/cloud')
const { normalizeEmail, emailToAccountId } = require('./email')
const { clearAllUserStorage } = require('./clear-storage')
const { safeReLaunch, safeSwitchTab } = require('./nav')
const config = require('../../config/index')
const {
  writeSession,
  clearSession,
  isSessionValid,
  readSession
} = require('./session')
const { clearAccountScopedAppData } = require('./account-scope')

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

function persistUserInfo(user) {
  if (!user || !user.email) return
  wx.setStorageSync('userInfo', {
    email: user.email,
    displayName: user.displayName || user.nickName || '',
    phone: user.phone || '',
    department: user.department || '',
    avatarUrl: user.avatarUrl || ''
  })
}

function applyUser(openId, user) {
  const nextOpenId = openId || (user && user.openId) || null
  const nextEmail = user && user.email ? String(user.email).trim().toLowerCase() : ''
  const prevEmail = state.userInfo && state.userInfo.email
    ? String(state.userInfo.email).trim().toLowerCase()
    : ''
  if (
    (state.openId && nextOpenId && state.openId !== nextOpenId) ||
    (prevEmail && nextEmail && prevEmail !== nextEmail)
  ) {
    state.notifications = []
    state.historyOwner = []
    state.historyPassenger = []
    clearAccountScopedAppData()
  }
  state.openId = nextOpenId
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
  persistUserInfo(user)
  if (user.email && state.openId) {
    writeSession(user.email, state.openId)
  }
  wx.setStorageSync('loggedIn', true)
  return state
}

function initFromStorage() {
  if (!isSessionValid()) {
    clearSession()
    state.openId = null
    state.userInfo = null
    return state
  }
  const session = readSession()
  const sessionAccountId = session && session.accountId ? String(session.accountId).trim() : ''
  const cached = wx.getStorageSync(CACHE_KEY)
  if (cached && cached.openId && cached.user) {
    if (!sessionAccountId || String(cached.openId).trim() === sessionAccountId) {
      applyUser(cached.openId, cached.user)
    }
  }
  return state
}

async function bootstrapCloudSession() {
  if (!isSessionValid()) {
    state.openId = null
    state.userInfo = null
    return state
  }

  const session = readSession()
  const sessionAccountId = session && session.accountId ? String(session.accountId).trim() : ''
  const cached = wx.getStorageSync(CACHE_KEY)
  const accountId = sessionAccountId || (cached && cached.openId ? String(cached.openId).trim() : '')
  if (!accountId) {
    return state
  }
  if (sessionAccountId && cached && cached.openId && String(cached.openId).trim() !== sessionAccountId) {
    try {
      wx.removeStorageSync(CACHE_KEY)
    } catch (error) {
      // ignore
    }
  }

  try {
    const user = await callFunction('user', { action: 'get', accountId })
    if (user) {
      applyUser(user.openId, user)
    }
  } catch (error) {
    if (error && (error.code === 'SESSION_INVALID' || error.code === 'NOT_LOGGED_IN')) {
      logout()
    }
  }
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
  clearAccountScopedAppData()
  state.notifications = []
  state.historyOwner = []
  state.historyPassenger = []
  if (verificationMode === 'smtp') {
    const accountId = emailToAccountId(normalized)
    const user = await callFunction('user', { action: 'get', accountId })
    if (!user || user.email !== normalized || !user.emailVerified) {
      const error = new Error('EMAIL_NOT_VERIFIED')
      error.code = 'EMAIL_NOT_VERIFIED'
      throw error
    }
    applyUser(user.openId, user)
    writeSession(normalized, user.openId)
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
  applyUser(user.openId, user)
  writeSession(normalized, user.openId)
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
  clearAllUserStorage()
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
