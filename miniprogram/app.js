const config = require('./config/index')
const authStore = config.useCloud
  ? require('./modules/auth/cloud-store')
  : require('./modules/auth/store')
const notification = require('./modules/notification/index')
const { flushNavQueue } = require('./modules/auth/nav')

/** bump 版本号可再次触发一次性清空已接单，便于广场自测 */
const PLAZA_ACCEPTED_RESET_VERSION = '20250823_v2'
const DEV_ORDERS_PURGE_VERSION = '20250904_v1'

App({
  onLaunch() {
    this._navReady = false
    this._navQueue = []

    if (config.useCloud && !wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else if (config.useCloud) {
      wx.cloud.init({
        env: config.cloudEnvId,
        traceUser: true
      })
    }

    if (!config.useCloud) {
      const { resetPlazaAcceptedOrders, purgeDevStageOrders } = require('./modules/order/service')
      const { refreshPlazaSeedOrders } = require('./modules/order/seed-orders')
      const devPurgeKey = `dev_orders_purge_${DEV_ORDERS_PURGE_VERSION}`
      if (!wx.getStorageSync(devPurgeKey)) {
        purgeDevStageOrders()
        wx.setStorageSync(devPurgeKey, '1')
      }
      const plazaResetKey = `plaza_accepted_reset_${PLAZA_ACCEPTED_RESET_VERSION}`
      if (!wx.getStorageSync(plazaResetKey)) {
        resetPlazaAcceptedOrders()
        wx.setStorageSync(plazaResetKey, '1')
      }
      refreshPlazaSeedOrders()
    }

    authStore.initFromStorage()
    authStore.syncGlobalData(this.globalData)
    if (config.useCloud && authStore.bootstrapCloudSession) {
      authStore.bootstrapCloudSession()
        .then(() => {
          this._syncAuth()
          if (authStore.isLoggedIn()) {
            return notification.refreshNotifications().catch(() => {})
          }
        })
        .catch(() => {
          // 登录页会展示可恢复的通用错误，启动阶段不暴露内部信息。
        })
    }
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

  async loginWithEmail(email, verificationMode) {
    await authStore.loginWithEmail(email, verificationMode)
    this._syncAuth()
  },

  routeAfterLogin() {
    authStore.routeAfterLogin()
  },

  logout() {
    authStore.logout()
    this._syncAuth()
  },

  async setUserMode(mode) {
    await authStore.setUserMode(mode)
    this._syncAuth()
  },

  async addIdentity(role) {
    await authStore.addIdentity(role)
    this._syncAuth()
  },

  async completeOnboarding() {
    await authStore.completeOnboarding()
    this._syncAuth()
  },

  async saveVehicle(vehicle) {
    await authStore.saveVehicle(vehicle)
    this._syncAuth()
  },

  async savePreference(preference) {
    await authStore.savePreference(preference)
    this._syncAuth()
  },

  async saveHabitTags(tags) {
    await authStore.saveHabitTags(tags)
    this._syncAuth()
  },

  hasIdentity(role) {
    return authStore.hasIdentity(role)
  },

  getMissingIdentity() {
    return authStore.getMissingIdentity()
  },

  switchMockUser(email) {
    const preset = authStore.switchMockUser(email)
    this._syncAuth()
    return preset
  },

  listMockTestUsers() {
    return authStore.getMockTestUsers()
  }
})
