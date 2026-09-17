/**
 * M4 — 语音文件持久化（本地 Mock）/ 云存储上传
 */

const config = require('../../config/index')

const playSrcCache = Object.create(null)

function persistLocalVoice(tempFilePath) {
  const fs = wx.getFileSystemManager()
  const dir = `${wx.env.USER_DATA_PATH}/m4_chat_voice`

  try {
    fs.accessSync(dir)
  } catch (error) {
    fs.mkdirSync(dir, true)
  }

  const dest = `${dir}/voice_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`

  return new Promise((resolve, reject) => {
    fs.saveFile({
      tempFilePath,
      filePath: dest,
      success: (res) => resolve(res.savedFilePath || dest),
      fail: (err) => reject(err)
    })
  })
}

function uploadCloudVoice(orderId, tempFilePath) {
  const safeOrderId = String(orderId || 'unknown').replace(/[^\w-]/g, '_')
  const cloudPath = `chat/voice/${safeOrderId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`

  return wx.cloud.uploadFile({
    cloudPath,
    filePath: tempFilePath
  }).then((result) => result.fileID)
}

async function storeVoiceFile(orderId, tempFilePath) {
  if (config.useCloud) {
    const voiceFileId = await uploadCloudVoice(orderId, tempFilePath)
    return { voiceFileId }
  }

  const voiceLocalPath = await persistLocalVoice(tempFilePath)
  return { voiceLocalPath }
}

async function resolveVoicePlaySrc(message) {
  if (!message) return ''

  const localPath = message.voiceLocalPath || ''
  if (localPath) {
    try {
      wx.getFileSystemManager().accessSync(localPath)
      return localPath
    } catch (error) {
      return ''
    }
  }

  const cachedSrc = message.voiceSrc && !String(message.voiceSrc).startsWith('cloud://')
    ? message.voiceSrc
    : ''
  if (cachedSrc) return cachedSrc

  const fileId = message.voiceFileId ||
    (String(message.voiceSrc || '').startsWith('cloud://') ? message.voiceSrc : '')
  if (!fileId) return ''

  if (playSrcCache[fileId]) return playSrcCache[fileId]

  if (!config.useCloud || !wx.cloud) return ''

  try {
    const response = await wx.cloud.downloadFile({ fileID: fileId })
    const tempFilePath = response && response.tempFilePath ? response.tempFilePath : ''
    if (tempFilePath) playSrcCache[fileId] = tempFilePath
    return tempFilePath
  } catch (error) {
    const err = new Error('语音下载失败')
    err.code = 'VOICE_DOWNLOAD_FAILED'
    throw err
  }
}

module.exports = {
  storeVoiceFile,
  resolveVoicePlaySrc
}
