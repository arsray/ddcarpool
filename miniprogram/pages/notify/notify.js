const app = getApp();
const auth = require('../../modules/auth/index');

function filterNotificationsForUser(list, openId) {
  if (!openId) return list || [];
  return (list || []).filter((item) => {
    if (item.recipientOpenId) return item.recipientOpenId === openId;
    if (item.passengerOpenId) return item.passengerOpenId === openId;
    return true;
  });
}

Page({
  data: { list: [] },
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    if (!auth.requireLogin()) return;
    auth.store.initFromStorage();
    auth.store.syncGlobalData(app.globalData);
    const openId = app.globalData.openId || '';
    const list = filterNotificationsForUser(app.globalData.notifications || [], openId);
    this.setData({ list });
  },
  onTap(e) {
    const item = this.data.list.find((n) => n.id === e.currentTarget.dataset.id);
    if (!item) return;
    item.read = true;
    const openId = app.globalData.openId || '';
    const all = app.globalData.notifications || [];
    const nextAll = all.map((entry) => (entry.id === item.id ? { ...entry, read: true } : entry));
    wx.setStorageSync('notifications', nextAll);
    auth.store.initFromStorage();
    auth.store.syncGlobalData(app.globalData);
    this.setData({ list: filterNotificationsForUser(nextAll, openId) });
    if (item.targetType === 'passenger' && item.targetId) {
      wx.navigateTo({
        url: `/pages/detail/detail?orderId=${item.targetId}`
      });
      return;
    }
    wx.navigateTo({
      url: `/pages/history-detail/history-detail?id=${item.targetId}&role=${item.targetType}`
    });
  }
});
