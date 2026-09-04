const app = getApp();
const auth = require('../../modules/auth/index');
const notification = require('../../modules/notification/index');

function formatItem(item) {
  const created = item.createdAt ? new Date(item.createdAt) : null;
  const time = created && !Number.isNaN(created.getTime())
    ? `${String(created.getHours()).padStart(2, '0')}:${String(created.getMinutes()).padStart(2, '0')}`
    : item.time || '';
  return { ...item, id: item._id || item.id, time };
}

Page({
  data: { list: [], loading: false },
  async onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    if (!auth.requireLogin()) return;
    this.setData({ loading: true });
    try {
      const list = await notification.listNotifications();
      app.globalData.notifications = list;
      this.setData({ list: list.map(formatItem) });
    } catch (error) {
      wx.showToast({ title: '消息加载失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
  async onTap(e) {
    const item = this.data.list.find((n) => n.id === e.currentTarget.dataset.id);
    if (!item) return;
    try {
      await notification.markRead(item.id);
      this.setData({
        list: this.data.list.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry)
      });
    } catch (error) {
      wx.showToast({ title: '消息状态更新失败', icon: 'none' });
    }
    if (item.targetId) {
      wx.navigateTo({
        url: `/pages/detail/detail?orderId=${item.targetId}&from=history`
      });
    }
  }
});
