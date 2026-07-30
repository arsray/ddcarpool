Page({
  data: {
    module: 'M4',
    pageName: '订单聊天',
    owner: 'M4 聊天',
    todo: '消息列表、发送文字、实时或轮询刷新',
    orderId: ''
  },

  onLoad(options) {
    this.setData({ orderId: options.orderId || '' })
  }
})
