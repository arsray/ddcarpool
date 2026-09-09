/**
 * 登出 / 切换账号时清理本地会话数据（不含 mock 用户快照）
 */
const USER_KEYS = [
  'cloudUserCache',
  'loggedIn',
  'userInfo',
  'authSession',
  'identities',
  'onboardingComplete',
  'userMode',
  'vehicle',
  'preference',
  'habitTags',
  'historyOwner',
  'historyPassenger',
  'notifications'
]

function clearAllUserStorage() {
  USER_KEYS.forEach((key) => {
    try {
      wx.removeStorageSync(key)
    } catch (error) {
      // 忽略单项清理失败
    }
  })

  try {
    const info = wx.getStorageInfoSync()
    ;(info.keys || []).forEach((key) => {
      if (key.startsWith('verify_')) {
        wx.removeStorageSync(key)
      }
    })
  } catch (error) {
    // 忽略
  }
}

module.exports = {
  clearAllUserStorage
}
