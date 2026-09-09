/**
 * 广场 Tab：按身份模式路由到车主接单页或乘客发布页
 */

function resolvePlazaPath(identities, userMode) {
  const ids = identities || []
  const hasOwner = ids.includes('owner')
  const hasPassenger = ids.includes('passenger')

  if (!hasOwner && hasPassenger) {
    return '/pages/publish/publish'
  }
  if (hasOwner && !hasPassenger) {
    return '/pages/index/index'
  }
  if (hasOwner && hasPassenger) {
    return userMode === 'passenger' ? '/pages/publish/publish' : '/pages/index/index'
  }
  return '/pages/index/index'
}

function refreshTabBar() {
  try {
    const pages = getCurrentPages()
    if (!pages.length) return
    const tabBar = pages[pages.length - 1].getTabBar && pages[pages.length - 1].getTabBar()
    if (tabBar && typeof tabBar.refreshPlaza === 'function') {
      tabBar.refreshPlaza()
    }
  } catch (error) {
    // App 未就绪时忽略
  }
}

function ensureCorrectPlazaPage() {
  const app = getApp()
  const target = resolvePlazaPath(app.globalData.identities, app.globalData.userMode)
  const pages = getCurrentPages()
  if (!pages.length) return target

  const current = pages[pages.length - 1]
  const route = `/${current.route}`
  const isPlazaPage = route === '/pages/index/index' || route === '/pages/publish/publish'

  if (isPlazaPage && route !== target) {
    wx.switchTab({ url: target })
  }
  refreshTabBar()
  return target
}

function notifyRoleFromTargetType(targetType) {
  return targetType === 'owner' ? 'owner' : 'passenger'
}

function notificationMatchesRole(item, role) {
  if (!item || !item.targetType) return true
  return notifyRoleFromTargetType(item.targetType) === role
}

function roleToUserMode(role) {
  return role === 'owner' ? 'owner' : 'passenger'
}

async function syncAppRole(role) {
  const app = getApp()
  const next = roleToUserMode(role)
  if (!app.hasIdentity(next)) return false
  if (app.globalData.userMode === next) return true
  await app.setUserMode(next)
  app._syncAuth()
  refreshTabBar()
  return true
}

module.exports = {
  resolvePlazaPath,
  refreshTabBar,
  ensureCorrectPlazaPage,
  notificationMatchesRole,
  roleToUserMode,
  syncAppRole
}
