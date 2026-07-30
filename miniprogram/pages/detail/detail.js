Page({
  data: {
    module: 'M3',
    pageName: '订单详情',
    owner: 'M3 订单生命周期 / 点位',
    todo: '详情展示、接取、取消、完成、跳转聊天',
    orderId: ''
  },

  onLoad(options) {
    this.setData({ orderId: options.orderId || '' })
  }
})
