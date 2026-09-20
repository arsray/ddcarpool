const config = require('../../config/index')
const { callFunction } = require('../../utils/cloud')
const auth = require('../auth/index')
const templates = require('./templates')
const stickers = require('./stickers')
const presenter = require('./presenter')
const mockStore = require('./mock-store')
const voiceStorage = require('./voice-storage')
const tripCard = require('./trip-card')

function normalizeParticipantName(name, role) {
  const text = String(name || '').trim()
  if (text && text !== '用户') return text
  return role === 'driver' ? '司机' : '乘客'
}

function buildParticipantsFromOrder(order) {
  if (!order) return null
  return {
    passenger: {
      name: normalizeParticipantName(order.passengerName, 'passenger'),
      avatarUrl: ''
    },
    driver: {
      name: normalizeParticipantName(order.driverName, 'driver'),
      avatarUrl: ''
    }
  }
}

function mergeChatParticipants(fromCloud, fromOrder) {
  const base = fromOrder || buildParticipantsFromOrder(null) || {
    passenger: { name: '乘客', avatarUrl: '' },
    driver: { name: '司机', avatarUrl: '' }
  }
  const cloud = fromCloud || {}

  return {
    passenger: {
      name: normalizeParticipantName(
        (cloud.passenger && cloud.passenger.name) || base.passenger.name,
        'passenger'
      ),
      avatarUrl: (cloud.passenger && cloud.passenger.avatarUrl) || base.passenger.avatarUrl || ''
    },
    driver: {
      name: normalizeParticipantName(
        (cloud.driver && cloud.driver.name) || base.driver.name,
        'driver'
      ),
      avatarUrl: (cloud.driver && cloud.driver.avatarUrl) || base.driver.avatarUrl || ''
    }
  }
}

function isOrderChatParticipant(order, currentOpenId) {
  if (!order || !currentOpenId) return false
  if (order.viewerRole === 'passenger' || order.viewerRole === 'driver') return true
  return (
    order.passengerOpenId === currentOpenId ||
    order.driverOpenId === currentOpenId
  )
}

function canEnterChat(order, currentOpenId) {
  if (!order || !currentOpenId) return false
  if (!['pending_departure', 'in_progress'].includes(order.status)) return false
  return isOrderChatParticipant(order, currentOpenId)
}

async function listMessages(orderId, options) {
  if (!config.useCloud) {
    const openId = await auth.ensureLogin()
    return mockStore.listMessages(orderId, openId, options || {})
  }
  return callFunction('message', {
    action: 'list',
    orderId,
    before: options && options.before ? options.before : ''
  })
}

async function markMessagesRead(orderId) {
  if (!config.useCloud) {
    const openId = await auth.ensureLogin()
    return mockStore.markMessagesRead(orderId, openId)
  }
  return callFunction('message', { action: 'markRead', orderId })
}

function presentMessages(messages, participants, myRole) {
  const enriched = (messages || []).map((item) => enrichMessage(item))
  return presenter.presentMessages(enriched, participants, myRole)
}

async function sendMessage(orderId, content) {
  if (!config.useCloud) {
    const openId = await auth.ensureLogin()
    return mockStore.sendText(orderId, openId, content)
  }
  return callFunction('message', { action: 'send', orderId, type: 'text', content })
}

async function sendVoice(orderId, tempFilePath, durationSec) {
  const stored = await voiceStorage.storeVoiceFile(orderId, tempFilePath)
  const sec = Math.max(1, Math.min(60, Math.round(Number(durationSec) || 1)))

  if (!config.useCloud) {
    const openId = await auth.ensureLogin()
    return mockStore.sendVoice(orderId, openId, {
      ...stored,
      durationSec: sec
    })
  }

  if (!stored.voiceFileId) {
    const error = new Error('语音上传失败')
    error.code = 'VOICE_UPLOAD_FAILED'
    throw error
  }

  return callFunction('message', {
    action: 'sendVoice',
    type: 'voice',
    orderId,
    voiceFileId: stored.voiceFileId,
    durationSec: sec
  })
}

async function sendSticker(orderId, stickerId) {
  const sticker = stickers.getStickerById(stickerId)
  if (!config.useCloud) {
    if (!sticker) {
      const error = new Error('表情不存在')
      error.code = 'INVALID_STICKER'
      throw error
    }
    const openId = await auth.ensureLogin()
    return mockStore.sendSticker(orderId, openId, stickerId)
  }
  if (!sticker) {
    const error = new Error('表情不存在')
    error.code = 'INVALID_STICKER'
    throw error
  }
  // 走 send + type=sticker，与 cloudfunctions/message 的 send 分支一致；
  // 部署含表情支持的 message 云函数后才会存为 sticker 类型。
  return callFunction('message', {
    action: 'sendSticker',
    orderId,
    type: 'sticker',
    stickerId: sticker.id
  })
}

function calcVoiceBubbleWidthRpx(durationSec) {
  const sec = Math.max(1, Math.min(60, Number(durationSec) || 1))
  return Math.min(420, 160 + sec * 6)
}

function enrichMessage(item) {
  if (!item) {
    return {
      ...item,
      isSystem: false,
      isSticker: false,
      isVoice: false,
      stickerSrc: '',
      voiceSrc: '',
      voiceDurationLabel: '',
      voiceBubbleWidthRpx: 160
    }
  }

  if (item.type === 'system' || item.isSystem) {
    return {
      ...item,
      isSystem: true,
      isSticker: false,
      isVoice: false,
      stickerSrc: '',
      voiceSrc: '',
      voiceDurationLabel: '',
      voiceBubbleWidthRpx: 160
    }
  }

  const sticker = stickers.resolveStickerFromMessage(item)
  const isSticker = item.type === 'sticker' || Boolean(item.stickerId) || Boolean(sticker)
  if (isSticker) {
    return {
      ...item,
      stickerId: (sticker && sticker.id) || item.stickerId || '',
      isSticker: Boolean(sticker),
      isVoice: false,
      stickerSrc: sticker ? sticker.src : '',
      stickerLabel: sticker ? sticker.label : '表情',
      voiceSrc: '',
      voiceDurationLabel: '',
      voiceBubbleWidthRpx: 160
    }
  }

  const isVoice = item.type === 'voice' || Boolean(item.voiceFileId || item.voiceLocalPath)
  if (isVoice) {
    const durationSec = Math.max(1, Math.min(60, Math.round(Number(item.durationSec) || 1)))
    return {
      ...item,
      isSticker: false,
      isVoice: true,
      stickerSrc: '',
      voiceSrc: item.voiceLocalPath || item.voiceFileId || item.voiceUrl || '',
      durationSec,
      voiceDurationLabel: `${durationSec}"`,
      voiceBubbleWidthRpx: calcVoiceBubbleWidthRpx(durationSec)
    }
  }

  return {
    ...item,
    isSticker: false,
    isVoice: false,
    stickerSrc: '',
    voiceSrc: '',
    voiceDurationLabel: '',
    voiceBubbleWidthRpx: 160
  }
}

module.exports = {
  isOrderChatParticipant,
  canEnterChat,
  listMessages,
  markMessagesRead,
  presentMessages,
  sendMessage,
  sendVoice,
  sendSticker,
  enrichMessage,
  resolveVoicePlaySrc: voiceStorage.resolveVoicePlaySrc,
  buildParticipantsFromOrder,
  mergeChatParticipants,
  listStickers: stickers.listStickers,
  buildStickerGridStyle: stickers.buildStickerGridStyle,
  getStickerPanelMetrics: stickers.getStickerPanelMetrics,
  resolveChatRole: templates.resolveChatRole,
  getMessageTemplates: templates.getMessageTemplates,
  buildTemplateTextSet: templates.buildTemplateTextSet,
  buildTripCardViewModel: tripCard.buildTripCardViewModel
}
