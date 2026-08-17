// SECURITY-REVIEW: 云环境 ID 从本地配置读取，勿硬编码或提交到仓库
let envConfig = {}
try {
  envConfig = require('./config/env.js')
} catch (e) {
  console.warn('[ddcarpool] 未找到 config/env.js，请复制 env.example.js 并填入云环境 ID')
}

const authStore = require('./modules/auth/store')
const { flushNavQueue } = require('./modules/auth/nav')

App({
  onLaunch() {
    this._navReady = false
    this._navQueue = []

    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: envConfig.cloudEnvId || undefined,
        traceUser: true
      })
    }

    authStore.initFromStorage()
    authStore.syncGlobalData(this.globalData)
  },

  onShow() {
    if (!this._navReady) {
      this._navReady = true
      flushNavQueue()
    }
  },

  globalData: {
    openId: null,
    userProfile: null,
    userMode: 'owner',
    userInfo: null,
    identities: [],
    onboardingComplete: false,
    vehicle: null,
    preference: null,
    habitTags: [],
    historyOwner: [],
    historyPassenger: [],
    notifications: []
  },

  _syncAuth() {
    authStore.syncGlobalData(this.globalData)
  },

  loginWithEmail(email) {
    authStore.loginWithEmail(email)
    this._syncAuth()
  },

  routeAfterLogin() {
    authStore.routeAfterLogin()
  },

  logout() {
    authStore.logout()
    this._syncAuth()
  },

  setUserMode(mode) {
    authStore.setUserMode(mode)
    this._syncAuth()
  },

  addIdentity(role) {
    authStore.addIdentity(role)
    this._syncAuth()
  },

  completeOnboarding() {
    authStore.completeOnboarding()
    this._syncAuth()
  },

  saveVehicle(vehicle) {
    authStore.saveVehicle(vehicle)
    this._syncAuth()
  },

  savePreference(preference) {
    authStore.savePreference(preference)
    this._syncAuth()
  },

  saveHabitTags(tags) {
    authStore.saveHabitTags(tags)
    this._syncAuth()
  },

  hasIdentity(role) {
    return authStore.hasIdentity(role)
  },

  getMissingIdentity() {
    return authStore.getMissingIdentity()
  }
})
