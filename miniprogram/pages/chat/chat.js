const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const chat = require('../../modules/chat/index')

function formatTime(value) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

Page({
  data: {
    orderId: '',
    messages: [],
    content: '',
    loading: true,
    loadingMore: false,
    sending: false,
    hasMore: false,
    scrollTarget: ''
  },

  async onLoad(options) {
    this.setData({ orderId: options.orderId || '' })
    if (!auth.requireLogin() || !this.data.orderId) return
    try {
      const openId = await auth.ensureLogin()
      const currentOrder = await order.getOrderById(this.data.orderId)
      if (!chat.canEnterChat(currentOrder, openId)) {
        wx.showToast({ title: '当前不可进入聊天', icon: 'none' })
        setTimeout(() => wx.navigateBack(), 400)
        return
      }
      await this.loadMessages()
      this.poller = setInterval(() => this.loadMessages(true), 5000)
    } catch (error) {
      wx.showToast({ title: error.message || '聊天加载失败', icon: 'none' })
    }
  },

  onUnload() {
    if (this.poller) clearInterval(this.poller)
  },

  async loadMessages(silent) {
    if (!silent) this.setData({ loading: true })
    try {
      const result = await chat.listMessages(this.data.orderId)
      const messages = (result.messages || []).map((item) => ({
        ...item,
        timeLabel: formatTime(item.createdAt)
      }))
      this.setData({
        messages,
        hasMore: result.hasMore,
        scrollTarget: messages.length ? `message-${messages[messages.length - 1]._id}` : ''
      })
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
      const older = (result.messages || []).map((item) => ({
        ...item,
        timeLabel: formatTime(item.createdAt)
      }))
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

  async onSend() {
    const content = this.data.content.trim()
    if (!content || this.data.sending) return
    this.setData({ sending: true })
    try {
      await chat.sendMessage(this.data.orderId, content)
      this.setData({ content: '' })
      await this.loadMessages(true)
    } catch (error) {
      wx.showToast({ title: error.message || '发送失败', icon: 'none' })
    } finally {
      this.setData({ sending: false })
    }
  }
})
