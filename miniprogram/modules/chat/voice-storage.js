/**
 * M4 — 语音文件持久化（本地 Mock）/ 云存储上传
 */

const config = require('../../config/index')

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

module.exports = {
  storeVoiceFile
}
