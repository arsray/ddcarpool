const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const chat = require('../../modules/chat/index')
const voice = require('../../modules/chat/voice')

function formatTime(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

Page({
  data: {
    orderId: '',
    myRole: 'passenger',
    peerName: '',
    tripCard: null,
    messages: [],
    content: '',
    loading: true,
    loadingMore: false,
    sending: false,
    hasMore: false,
    scrollTarget: '',
    roleLabel: '',
    quickTemplates: [],
    templateGroups: [],
    showTemplatePanel: false,
    showStickerPanel: false,
    stickers: [],
    stickerGridStyle: '',
    inputMode: 'text',
    inputFocus: false,
    voiceRecording: false,
    voiceWillCancel: false,
    playingVoiceId: ''
  },

  voiceStartY: 0,
  voiceStartPromise: null,

  async onLoad(options) {
    const orderId = String(options.orderId || options.id || '').trim()
    this.setData({ orderId })

    if (!auth.requireLogin()) {
      this.setData({ loading: false })
      return
    }
    if (!orderId) {
      wx.showToast({ title: '缺少订单 ID', icon: 'none' })
      this.setData({ loading: false })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }

    try {
      const openId = await auth.ensureLogin()
      const currentOrder = await order.getOrderById(orderId)
      if (!chat.canEnterChat(currentOrder, openId)) {
        wx.showToast({ title: '当前不可进入聊天', icon: 'none' })
        this.setData({ loading: false })
        setTimeout(() => wx.navigateBack(), 400)
        return
      }

      const myRole = chat.resolveChatRole(currentOrder, openId) || 'passenger'
      const peerName = myRole === 'driver'
        ? (currentOrder.passengerName || '乘客')
        : (currentOrder.driverName || '车主')
      const { roleLabel, quickTemplates, templateGroups } = chat.getMessageTemplates(myRole)
      const stickers = chat.listStickers()

      wx.setNavigationBarTitle({ title: peerName })

      this.orderParticipants = chat.buildParticipantsFromOrder(currentOrder)
      this.currentOrder = currentOrder

      this.setData({
        myRole,
        peerName,
        tripCard: chat.buildTripCardViewModel(currentOrder, order.formatRoute),
        roleLabel,
        quickTemplates,
        templateGroups,
        stickers,
        stickerGridStyle: chat.buildStickerGridStyle(stickers.length)
      })

      await this.loadMessages()
      this.poller = setInterval(() => this.loadMessages(true), 5000)
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '聊天加载失败', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 600)
    }
  },

  onShow() {
    if (this.data.orderId && !this.data.loading) {
      this.loadMessages(true)
    }
  },

  onUnload() {
    if (this.poller) clearInterval(this.poller)
    this.destroyVoicePlayer()
    if (this.data.voiceRecording) {
      voice.cancelHold().catch(() => {})
    }
  },

  destroyVoicePlayer() {
    if (!this.audioCtx) return
    this.audioCtx.stop()
    this.audioCtx.destroy()
    this.audioCtx = null
    this.setData({ playingVoiceId: '' })
  },

  ensureVoicePlayer() {
    if (this.audioCtx) return this.audioCtx
    const ctx = wx.createInnerAudioContext()
    ctx.obeyMuteSwitch = false
    ctx.onEnded(() => this.setData({ playingVoiceId: '' }))
    ctx.onStop(() => this.setData({ playingVoiceId: '' }))
    ctx.onError(() => {
      this.setData({ playingVoiceId: '' })
      wx.showToast({ title: '语音播放失败', icon: 'none' })
    })
    this.audioCtx = ctx
    return ctx
  },

  playVoiceSrc(messageId, voiceSrc) {
    const player = this.ensureVoicePlayer()
    if (this.data.playingVoiceId === messageId) {
      player.stop()
      this.setData({ playingVoiceId: '' })
      return
    }

    player.stop()
    this.setData({ playingVoiceId: messageId })

    const startPlayback = () => {
      player.play()
    }

    if (typeof player.offCanplay === 'function') {
      player.offCanplay()
    }
    player.onCanplay(startPlayback)
    player.src = voiceSrc

    if (typeof player.onCanplay !== 'function') {
      startPlayback()
    }
  },

  buildViewMessages(result) {
    const participants = chat.mergeChatParticipants(
      result.participants || null,
      this.orderParticipants
    )
    const presented = chat.presentMessages(result.messages, participants, this.data.myRole)
    return presented.map((item) => ({
      ...item,
      timeLabel: formatTime(item.createdAt)
    }))
  },

  applyMessageResult(result, options) {
    const opts = options || {}
    const messages = this.buildViewMessages(result)
    const next = {
      messages,
      hasMore: result.hasMore
    }
    if (opts.scrollToBottom !== false) {
      next.scrollTarget = messages.length ? `message-${messages[messages.length - 1]._id}` : ''
    }
    this.setData(next)
    return messages
  },

  async syncReadReceipts() {
    await chat.markMessagesRead(this.data.orderId)
    const refreshed = await chat.listMessages(this.data.orderId)
    this.applyMessageResult(refreshed, { scrollToBottom: false })
  },

  async loadMessages(silent) {
    if (!silent) this.setData({ loading: true })
    try {
      const result = await chat.listMessages(this.data.orderId)
      this.applyMessageResult(result)
      try {
        await this.syncReadReceipts()
      } catch (readError) {
        console.warn('[chat] markRead failed', readError)
      }
    } catch (error) {
      if (!silent) wx.showToast({ title: error.message || '消息加载失败', icon: 'none' })
    } finally {
      if (!silent) this.setData({ loading: false })
    }
  },

  async loadOlder() {
    if (!this.data.hasMore || this.data.loadingMore || !this.data.messages.length) return
    const first = this.data.messages[0]
    this.setData({ loadingMore: true })
    try {
      const result = await chat.listMessages(this.data.orderId, { before: first.createdAt })
      const older = this.buildViewMessages(result)
      this.setData({
        messages: [...older, ...this.data.messages],
        hasMore: result.hasMore
      })
    } catch (error) {
      wx.showToast({ title: '更早消息加载失败', icon: 'none' })
    } finally {
      this.setData({ loadingMore: false })
    }
  },

  onInput(e) {
    this.setData({ content: e.detail.value })
  },

  onInputBlur() {
    if (this.data.inputFocus) {
      this.setData({ inputFocus: false })
    }
  },

  scrollChatToBottom() {
    const messages = this.data.messages
    if (!messages.length) return
    const lastId = messages[messages.length - 1]._id
    this.setData({ scrollTarget: '' }, () => {
      this.setData({ scrollTarget: `message-${lastId}` })
    })
  },

  openStickerPanel() {
    wx.hideKeyboard()
    this.setData({
      showStickerPanel: true,
      showTemplatePanel: false,
      inputMode: 'text',
      inputFocus: false
    }, () => {
      this.scrollChatToBottom()
    })
  },

  closeStickerPanel(focusInput) {
    this.setData({
      showStickerPanel: false,
      inputMode: 'text',
      inputFocus: Boolean(focusInput)
    })
  },

  toggleInputMode() {
    const nextMode = this.data.inputMode === 'text' ? 'voice' : 'text'
    this.setData({
      inputMode: nextMode,
      showStickerPanel: false,
      showTemplatePanel: false,
      inputFocus: false,
      voiceRecording: false,
      voiceWillCancel: false
    })
    if (nextMode === 'voice') {
      wx.hideKeyboard()
      voice.ensureRecordPermission().catch(() => {})
    }
  },

  toggleTemplatePanel() {
    this.setData({
      showTemplatePanel: !this.data.showTemplatePanel,
      showStickerPanel: false,
      inputMode: 'text',
      inputFocus: false
    })
  },

  toggleStickerPanel() {
    if (this.data.showStickerPanel) {
      this.closeStickerPanel(true)
      return
    }
    this.openStickerPanel()
  },

  onQuickTemplateTap(e) {
    const text = e.currentTarget.dataset.text
    if (text) this.sendContent(text)
  },

  onStickerTap(e) {
    const stickerId = e.currentTarget.dataset.id
    if (stickerId) this.sendSticker(stickerId)
  },

  onVoiceTouchStart(e) {
    if (!voice.isVoiceInputEnabled() || this.data.sending || this.data.voiceRecording) return

    const touch = e.touches && e.touches[0]
    this.voiceStartY = touch ? touch.clientY : 0
    this.voiceWillCancel = false
    this.setData({ voiceRecording: true, voiceWillCancel: false })

    this.voiceStartPromise = voice.startHold().catch((error) => {
      this.setData({ voiceRecording: false, voiceWillCancel: false })
      wx.showToast({ title: error.message || '无法开始录音', icon: 'none' })
      throw error
    })
  },

  onVoiceTouchMove(e) {
    if (!this.data.voiceRecording) return
    const touch = e.touches && e.touches[0]
    if (!touch) return
    const willCancel = this.voiceStartY - touch.clientY > 80
    if (willCancel !== this.data.voiceWillCancel) {
      this.setData({ voiceWillCancel: willCancel })
    }
  },

  async onVoiceTouchEnd() {
    if (!this.data.voiceRecording && !this.voiceStartPromise) return

    const willCancel = this.data.voiceWillCancel
    this.setData({ voiceRecording: false, voiceWillCancel: false })

    try {
      if (this.voiceStartPromise) {
        await this.voiceStartPromise.catch(() => null)
      }
      if (willCancel) {
        await voice.cancelHold()
        return
      }
      const result = await voice.stopHold()
      if (!result) return
      await this.sendVoiceMessage(result.tempFilePath, result.durationSec)
    } catch (error) {
      const message =
        error && error.code === 'RECORD_TOO_SHORT'
          ? '说话时间太短'
          : (error && error.message) || '录音失败'
      wx.showToast({ title: message, icon: 'none' })
    } finally {
      this.voiceStartPromise = null
    }
  },

  async onVoiceTouchCancel() {
    if (!this.data.voiceRecording && !this.voiceStartPromise) return
    this.setData({ voiceRecording: false, voiceWillCancel: false })
    try {
      if (this.voiceStartPromise) {
        await this.voiceStartPromise.catch(() => null)
      }
      await voice.cancelHold()
    } finally {
      this.voiceStartPromise = null
    }
  },

  preventVoiceTouchMove() {},

  async sendVoiceMessage(tempFilePath, durationSec) {
    if (this.data.sending) return

    this.setData({ sending: true })
    try {
      await chat.sendVoice(this.data.orderId, tempFilePath, durationSec)
      await this.loadMessages(true)
      this.scrollChatToBottom()
    } catch (error) {
      const msg = (error && error.message) || '语音发送失败'
      wx.showToast({
        title: error && error.code === 'VOICE_UPLOAD_FAILED' ? '语音上传失败' : msg,
        icon: 'none'
      })
    } finally {
      this.setData({ sending: false })
    }
  },

  async onVoiceMessageTap(e) {
    const messageId = e.currentTarget.dataset.id
    const message = (this.data.messages || []).find((item) => item._id === messageId)
    if (!message || !message.isVoice) return

    if (this.data.playingVoiceId === messageId) {
      this.playVoiceSrc(messageId, '')
      return
    }

    try {
      const voiceSrc = await chat.resolveVoicePlaySrc(message)
      if (!voiceSrc) {
        wx.showToast({ title: '语音文件无效', icon: 'none' })
        this.setData({ playingVoiceId: '' })
        return
      }
      this.playVoiceSrc(messageId, voiceSrc)
    } catch (error) {
      this.setData({ playingVoiceId: '' })
      wx.showToast({ title: (error && error.message) || '语音播放失败', icon: 'none' })
    }
  },

  async onSend() {
    const content = this.data.content.trim()
    if (!content) return
    await this.sendContent(content)
    this.setData({ content: '' })
  },

  async sendContent(content) {
    const text = String(content || '').trim()
    if (!text || this.data.sending) return

    this.setData({ sending: true })
    try {
      await chat.sendMessage(this.data.orderId, text)
      this.setData({ content: '', showTemplatePanel: false, showStickerPanel: false })
      await this.loadMessages(true)
    } catch (error) {
      wx.showToast({ title: error.message || '发送失败', icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  },

  async sendSticker(stickerId) {
    if (this.data.sending) return

    this.setData({ sending: true })
    try {
      await chat.sendSticker(this.data.orderId, stickerId)
      this.setData({ showStickerPanel: false, showTemplatePanel: false })
      await this.loadMessages(true)
    } catch (error) {
      const msg = error && error.message ? error.message : '表情发送失败'
      const code = error && error.code ? error.code : ''
      if (
        code === 'INVALID_ACTION' ||
        msg.indexOf('不支持的聊天操作') !== -1 ||
        msg.indexOf('1–500') !== -1 ||
        msg.indexOf('1-500') !== -1
      ) {
        wx.showToast({
          title: '请部署 message 云函数（含表情）',
          icon: 'none',
          duration: 3000
        })
      } else {
        wx.showToast({ title: msg, icon: 'none' })
      }
    } finally {
      this.setData({ sending: false })
    }
  }
})
