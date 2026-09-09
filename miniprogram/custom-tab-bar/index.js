const { resolvePlazaPath } = require('../modules/auth/plaza-tab')

Component({
  data: {
    selected: 0,
    unreadCount: 0,
    plazaPath: '/pages/index/index',
    list: [
      { key: 'plaza', text: '广场', icon: 'plaza' },
      { key: 'notify', pagePath: '/pages/notify/notify', text: '消息', icon: 'message' },
      { key: 'mine', pagePath: '/pages/mine/mine', text: '我的', icon: 'mine' }
    ]
  },

  lifetimes: {
    attached() {
      this.refreshPlaza()
    }
  },

  methods: {
    setUnreadCount(count) {
      const unreadCount = Math.max(0, Number(count) || 0)
      if (unreadCount !== this.data.unreadCount) {
        this.setData({ unreadCount })
      }
    },

    refreshPlaza() {
      try {
        const app = getApp()
        const plazaPath = resolvePlazaPath(
          app.globalData.identities,
          app.globalData.userMode
        )
        this.setData({ plazaPath })
      } catch (error) {
        // App 未就绪
      }
    },

    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item || index === this.data.selected) return

      const url = item.key === 'plaza' ? this.data.plazaPath : item.pagePath
      wx.switchTab({ url })
    },

    setSelectedByRoute(route) {
      if (!route) return
      if (route.indexOf('index') >= 0 || route.indexOf('publish') >= 0) {
        this.setData({ selected: 0 })
        return
      }
      if (route.indexOf('notify') >= 0) {
        this.setData({ selected: 1 })
        return
      }
      if (route.indexOf('mine') >= 0) {
        this.setData({ selected: 2 })
      }
    }
  }
})
