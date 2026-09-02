Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '车主', icon: 'owner' },
      { pagePath: '/pages/publish/publish', text: '乘客', icon: 'passenger' },
      { pagePath: '/pages/notify/notify', text: '消息', icon: 'message' },
      { pagePath: '/pages/mine/mine', text: '我的', icon: 'mine' }
    ]
  },

  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item || index === this.data.selected) return
      wx.switchTab({ url: item.pagePath })
    }
  }
})
