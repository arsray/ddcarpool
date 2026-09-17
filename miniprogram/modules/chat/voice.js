/**
 * M4 — 按住说话录音（语音消息，不转文字）
 */

const MIN_DURATION_MS = 800
const MAX_DURATION_MS = 60000

let recorder = null
let setupDone = false
let recording = false
let recordStartedAt = 0
let stopPromise = null
let startPromise = null

function makeError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function getRecorder() {
  if (!recorder) {
    recorder = wx.getRecorderManager()
  }
  return recorder
}

function setupRecorderOnce() {
  if (setupDone) return
  const mgr = getRecorder()

  mgr.onStop((res) => {
    recording = false
    if (!stopPromise) return
    const pending = stopPromise
    stopPromise = null
    pending.resolve(res)
  })

  mgr.onError((err) => {
    recording = false
    if (!stopPromise) return
    const pending = stopPromise
    stopPromise = null
    pending.reject(makeError('RECORD_FAILED', (err && err.errMsg) || '录音失败'))
  })

  setupDone = true
}

function isVoiceInputEnabled() {
  return true
}

function getVoicePlaceholderHint() {
  return '按住下方按钮说话'
}

function ensureRecordPermission() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.record']) {
          resolve()
          return
        }
        wx.authorize({
          scope: 'scope.record',
          success: () => resolve(),
          fail: () => {
            wx.showModal({
              title: '需要麦克风权限',
              content: '请允许录音权限，以便发送语音消息',
              confirmText: '去设置',
              success: (modal) => {
                if (!modal.confirm) {
                  reject(makeError('RECORD_DENIED', '未授权麦克风'))
                  return
                }
                wx.openSetting({
                  success: (setting) => {
                    if (setting.authSetting['scope.record']) resolve()
                    else reject(makeError('RECORD_DENIED', '未授权麦克风'))
                  },
                  fail: () => reject(makeError('RECORD_DENIED', '未授权麦克风'))
                })
              }
            })
          }
        })
      },
      fail: () => reject(makeError('RECORD_FAILED', '无法获取权限状态'))
    })
  })
}

async function awaitStartIfNeeded() {
  if (!startPromise) return
  await startPromise
}

async function startHold() {
  setupRecorderOnce()
  if (recording || startPromise) {
    throw makeError('RECORD_BUSY', '正在录音')
  }

  startPromise = (async () => {
    await ensureRecordPermission()
    if (recording) return
    recording = true
    recordStartedAt = Date.now()
    getRecorder().start({
      duration: MAX_DURATION_MS,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    })
  })()

  try {
    await startPromise
  } catch (error) {
    recording = false
    throw error
  } finally {
    startPromise = null
  }
}

function normalizeStopResult(res) {
  const durationMs =
    res && typeof res.duration === 'number' && res.duration > 0
      ? res.duration
      : Date.now() - recordStartedAt

  if (!res || !res.tempFilePath) {
    throw makeError('RECORD_FAILED', '录音文件无效')
  }
  if (durationMs < MIN_DURATION_MS) {
    throw makeError('RECORD_TOO_SHORT', '说话时间太短')
  }

  const durationSec = Math.max(1, Math.min(60, Math.round(durationMs / 1000)))
  return {
    tempFilePath: res.tempFilePath,
    durationMs,
    durationSec
  }
}

async function stopHold() {
  await awaitStartIfNeeded()
  if (!recording) {
    return Promise.reject(makeError('NOT_RECORDING', '未在录音'))
  }

  return new Promise((resolve, reject) => {
    stopPromise = {
      resolve: (res) => {
        try {
          resolve(normalizeStopResult(res))
        } catch (error) {
          reject(error)
        }
      },
      reject
    }
    getRecorder().stop()
  })
}

async function cancelHold() {
  await awaitStartIfNeeded()
  if (!recording) return null

  return new Promise((resolve) => {
    stopPromise = {
      resolve: () => resolve(null),
      reject: () => resolve(null)
    }
    getRecorder().stop()
  })
}

function isRecording() {
  return recording
}

module.exports = {
  MIN_DURATION_MS,
  MAX_DURATION_MS,
  isVoiceInputEnabled,
  getVoicePlaceholderHint,
  ensureRecordPermission,
  startHold,
  stopHold,
  cancelHold,
  isRecording
}
