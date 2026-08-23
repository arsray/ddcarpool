const app = getApp();
const auth = require('../../modules/auth/index');

Page({
  data: { list: [] },
  onShow() {
    if (!auth.requireLogin()) return;
    auth.store.initFromStorage();
    auth.store.syncGlobalData(app.globalData);
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