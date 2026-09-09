const agreement = require('../../content/user-agreement')

Page({
  data: {
    title: '',
    updatedAt: '',
    intro: '',
    sections: []
  },

  onLoad() {
    this.setData({
      title: agreement.title,
      updatedAt: agreement.updatedAt,
      intro: agreement.intro,
      sections: agreement.sections
    })
    wx.setNavigationBarTitle({ title: '用户服务协议' })
  }
})
