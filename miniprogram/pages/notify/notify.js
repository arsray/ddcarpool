const app = getApp();
const { requireLogin } = require('../../utils/util');

Page({
  data: { list: [] },
  onShow() {
    if (!requireLogin()) return;
    this.setData({ list: app.globalData.notifications || [] });
  },
  onTap(e) {
    const item = this.data.list.find((n) => n.id === e.currentTarget.dataset.id);
    if (!item) return;
    item.read = true;
    wx.setStorageSync('notifications', this.data.list);
    wx.navigateTo({
      url: `/pages/history-detail/history-detail?id=${item.targetId}&role=${item.targetType}`
    });
  }
});