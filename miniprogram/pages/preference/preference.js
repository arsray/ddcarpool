const app = getApp();
const auth = require('../../modules/auth/index');
const { PREFERENCE_NOTE_TAGS } = require('../../modules/auth/vehicle-data');

const COUNT_RANGE = Array.from({ length: 10 }, (_, i) => i + 1);

Page({
  data: {
    form: { defaultCount: 1, note: '', noteTags: [] },
    countRange: COUNT_RANGE,
    countIndex: 0,
    noteTags: PREFERENCE_NOTE_TAGS,
    selectedNoteMap: {},
    onboarding: false,
    setup: false
  },

  onLoad(options) {
    this.setData({
      onboarding: options.onboarding === '1',
      setup: options.setup === '1'
    });
  },

  onShow() {
    if (!auth.requireLogin()) return;
    const pref = app.globalData.preference || { defaultCount: 1, note: '', noteTags: [] };
    const selectedNoteMap = {};
    (pref.noteTags || []).forEach((t) => { selectedNoteMap[t] = true; });
    this.setData({
      form: {
        defaultCount: pref.defaultCount || 1,
        note: pref.note || '',
        noteTags: pref.noteTags || []
      },
      countIndex: Math.max(0, (pref.defaultCount || 1) - 1),
      selectedNoteMap
    });
  },

  onCountChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      countIndex: index,
      'form.defaultCount': COUNT_RANGE[index]
    });
  },

  toggleNoteTag(e) {
    const tag = e.currentTarget.dataset.tag;
    const selectedNoteMap = { ...this.data.selectedNoteMap, [tag]: !this.data.selectedNoteMap[tag] };
    if (!selectedNoteMap[tag]) delete selectedNoteMap[tag];
    this.setData({ selectedNoteMap });
  },

  onNoteInput(e) {
    this.setData({ 'form.note': e.detail.value });
  },

  onSave() {
    const noteTags = Object.keys(this.data.selectedNoteMap).filter((k) => this.data.selectedNoteMap[k]);
    const payload = {
      defaultCount: this.data.form.defaultCount,
      noteTags,
      note: this.data.form.note.trim()
    };
    app.savePreference(payload);
    let title = '已保存';
    if (this.data.setup) title = '乘车人身份已添加';
    else if (this.data.onboarding) title = '乘车偏好已保存';
    this.finishGuide(title);
  },

  onSkip() {
    this.finishGuide('可稍后在「我的」中填写偏好');
  },

  finishGuide(toastTitle) {
    if (this.data.onboarding) {
      app.completeOnboarding();
    }
    wx.showToast({ title: toastTitle, icon: 'none' });
    if (this.data.onboarding || this.data.setup) {
      setTimeout(() => wx.switchTab({ url: '/pages/mine/mine' }), 500);
      return;
    }
    setTimeout(() => wx.navigateBack(), 500);
  }
});
