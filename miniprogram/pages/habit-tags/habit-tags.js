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

  onSave() {
    const tags = Object.keys(this.data.selectedMap).filter((k) => this.data.selectedMap[k]);
    app.saveHabitTags(tags);
    wx.showToast({ title: '已保存' });
    setTimeout(() => wx.navigateBack(), 500);
  }
});
