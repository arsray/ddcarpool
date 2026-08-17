/**
 * 延迟导航，避免 appLaunch 阶段 page stack 未就绪时 reLaunch 报错
 * （开发者工具热重载 / canary 基础库常见）
 */

const LAUNCH_DELAY_MS = 120

function getAppSafe() {
  try {
    return getApp()
  } catch (e) {
    return null
  }
}

function isAppNavReady() {
  const app = getAppSafe()
  return !!(app && app._navReady)
}

function enqueueNavigate(run) {
  const app = getAppSafe()
  if (!app) {
    setTimeout(run, LAUNCH_DELAY_MS)
    return
  }
  if (!app._navQueue) app._navQueue = []
  app._navQueue.push(run)
}

function flushNavQueue() {
  const app = getAppSafe()
  if (!app || !app._navQueue || !app._navQueue.length) return
  const queue = app._navQueue.slice()
  app._navQueue = []
  queue.forEach((run, index) => {
    setTimeout(run, LAUNCH_DELAY_MS + index * 30)
  })
}

function deferNavigate(run) {
  if (typeof run !== 'function') return
  if (!isAppNavReady()) {
    enqueueNavigate(run)
    return
  }
  wx.nextTick(() => {
    setTimeout(run, LAUNCH_DELAY_MS)
  })
}

function safeReLaunch(url) {
  deferNavigate(() => {
    wx.reLaunch({ url })
  })
}

function safeSwitchTab(url) {
  deferNavigate(() => {
    wx.switchTab({ url })
  })
}

/** Tab 预加载时 onShow 也会触发，仅当前栈顶页面才执行跳转逻辑 */
function isTopPage(route) {
  const pages = getCurrentPages()
  if (!pages.length) return false
  const top = pages[pages.length - 1]
  return !!(top && top.route === route)
}

module.exports = {
  deferNavigate,
  safeReLaunch,
  safeSwitchTab,
  flushNavQueue,
  isTopPage
}
