/**
 * 旧版订单详情入口 — 重定向到统一详情页 pages/detail/detail
 */
Page({
  onLoad(options) {
    const orderId = options.orderId || options.id || ''
    if (!orderId) {
      wx.showToast({ title: '缺少订单 ID', icon: 'none' })
      return
    }
    const role = options.role || 'owner'
    const from = options.from ? `&from=${options.from}` : '&from=history'
    wx.redirectTo({
      url: `/pages/detail/detail?orderId=${orderId}&role=${role}${from}`
    })
  }
})
