const app = getApp();
const { requireLogin } = require('../../utils/util');

Page({
  data: {
    identities: [],
    userMode: 'owner',
    missingRole: '',
    addButtonLabel: ''
  },

  onShow() {
    if (!requireLogin()) return;
    this.refresh();
  },

  refresh() {
    const identities = app.globalData.identities || [];
    const missingRole = app.getMissingIdentity();
    const addButtonLabel = missingRole === 'owner'
      ? '+ 添加车主身份'
      : missingRole === 'passenger'
        ? '+ 添加乘车人身份'
        : '';

    this.setData({
      identities,
      userMode: app.globalData.userMode,
      missingRole,
      addButtonLabel
    });
  },

  onAdd() {
    const role = app.getMissingIdentity();
    if (!role) return;

    const label = role === 'owner' ? '车主' : '乘车人';
    wx.showModal({
      title: `添加${label}身份`,
      content: `添加后可在「我的」中切换${label}模式，是否继续？`,
      confirmText: '添加',
      success: (res) => {
        if (!res.confirm) return;
        app.addIdentity(role);
        const url = role === 'owner'
          ? '/pages/vehicle/vehicle?setup=1'
          : '/pages/preference/preference?setup=1';
        wx.navigateTo({ url });
      }
    });
  }
});
