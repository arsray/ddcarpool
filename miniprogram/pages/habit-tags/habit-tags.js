const app = getApp();
const { requireLogin } = require('../../utils/util');
const { HABIT_TAG_POOL } = require('../../utils/vehicle-data');

Page({
  data: { tagPool: HABIT_TAG_POOL, selectedMap: {} },

  onShow() {
    if (!requireLogin()) return;
    const selected = app.globalData.habitTags || [];
    const selectedMap = {};
    selected.forEach((t) => { selectedMap[t] = true; });
    this.setData({ selectedMap });
  },

  toggleTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const selectedMap = { ...this.data.selectedMap, [tag]: !this.data.selectedMap[tag] };
    if (!selectedMap[tag]) delete selectedMap[tag];
    this.setData({ selectedMap });
  },

  async onSave() {
    const tags = Object.keys(this.data.selectedMap).filter((k) => this.data.selectedMap[k]);
    try {
      await app.saveHabitTags(tags);
      wx.showToast({ title: '已保存' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (error) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  }
});
