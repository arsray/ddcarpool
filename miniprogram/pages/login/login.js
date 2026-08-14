const app = getApp()
const { validateEmailPrefix, normalizeLocalPart } = require('../../modules/auth/email')
const { sendCode, verifyCode, getCooldownRemain } = require('../../modules/auth/verify')
const { deferNavigate, isTopPage } = require('../../modules/auth/nav')

Page({
  data: {
    emailPrefix: '',
    code: '',
    emailError: '',
    codeError: '',
    canSendCode: false,
    canSubmit: false,
    sendText: '获取验证码',
    previewCode: '',
    cooldownTimer: null
  },

  onShow() {
    if (!isTopPage('pages/login/login')) return
    if (wx.getStorageSync('loggedIn')) {
      deferNavigate(() => app.routeAfterLogin())
    }
  },

  onUnload() {
    this.clearCooldownTimer()
  },

  clearCooldownTimer() {
    if (this.data.cooldownTimer) {
      clearInterval(this.data.cooldownTimer)
      this.setData({ cooldownTimer: null })
    }
  },

  onEmailPrefixInput(e) {
    this.setData({ emailPrefix: e.detail.value, emailError: '', codeError: '' })
    this.refreshButtonState()
  },

  onEmailBlur() {
    const emailPrefix = normalizeLocalPart(this.data.emailPrefix)
    this.setData({ emailPrefix })
    this.validateEmailField(true)
    this.refreshButtonState()
  },

  onCodeInput(e) {
    this.setData({ code: e.detail.value.trim(), codeError: '' })
  },

  validateEmailField(showError) {
    const result = validateEmailPrefix(this.data.emailPrefix)
    if (!result.ok && showError) {
      this.setData({ emailError: result.message })
    }
    return result
  },

  refreshButtonState() {
    const emailResult = validateEmailPrefix(this.data.emailPrefix)
    const remain = emailResult.ok ? getCooldownRemain(emailResult.email) : 0
    this.setData({
      canSendCode: emailResult.ok && remain === 0,
      canSubmit: emailResult.ok
    })
    if (remain > 0) {
      this.startCooldown(remain)
    }
  },

  startCooldown(seconds) {
    this.clearCooldownTimer()
    let remain = seconds
    this.setData({ canSendCode: false, sendText: `${remain}s 后重发` })
    const timer = setInterval(() => {
      remain -= 1
      if (remain <= 0) {
        this.clearCooldownTimer()
        const emailResult = validateEmailPrefix(this.data.emailPrefix)
        this.setData({
          sendText: '获取验证码',
          canSendCode: emailResult.ok
        })
        return
      }
      this.setData({ sendText: `${remain}s 后重发` })
    }, 1000)
    this.setData({ cooldownTimer: timer })
  },

  sendCode() {
    const result = this.validateEmailField(true)
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' })
      this.refreshButtonState()
      return
    }

    const sendResult = sendCode(result.email)
    if (!sendResult.ok) {
      wx.showToast({ title: sendResult.message, icon: 'none' })
      if (sendResult.remain) {
        this.startCooldown(sendResult.remain)
      }
      return
    }

    wx.showToast({ title: '验证码已发送', icon: 'none' })
    this.setData({ previewCode: sendResult.code })
    this.startCooldown(60)
  },

  onLogin() {
    const emailResult = this.validateEmailField(true)
    if (!emailResult.ok) {
      wx.showToast({ title: emailResult.message, icon: 'none' })
      return
    }

    const { code } = this.data
    if (!code) {
      this.setData({ codeError: '请输入验证码' })
      wx.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }

    const verifyResult = verifyCode(emailResult.email, code)
    if (!verifyResult.ok) {
      this.setData({ codeError: verifyResult.message })
      wx.showToast({ title: verifyResult.message, icon: 'none' })
      return
    }

    app.loginWithEmail(verifyResult.email)
    app.routeAfterLogin()
  }
})
