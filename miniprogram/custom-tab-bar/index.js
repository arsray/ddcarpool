Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '广场' },
      { pagePath: '/pages/publish/publish', text: '发布' },
      { pagePath: '/pages/mine/mine', text: '我的' }
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
