// SECURITY-REVIEW: 云环境 ID 从本地配置读取，勿硬编码或提交到仓库
let envConfig = {}
try {
  envConfig = require('./config/env.js')
} catch (e) {
  console.warn('[ddcarpool] 未找到 config/env.js，请复制 env.example.js 并填入云环境 ID')
}

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      return
    }

    wx.cloud.init({
      env: envConfig.cloudEnvId || undefined,
      traceUser: true
    })
  },

  globalData: {
    openId: null,
    userProfile: null
  }
})
