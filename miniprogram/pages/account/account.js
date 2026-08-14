const app = getApp();
const { requireLogin } = require('../../utils/util');
const { safeReLaunch } = require('../../modules/auth/nav');

Page({
  data: { userInfo: {}, phoneText: '未绑定 · 可选', identitySummary: '' },

  onShow() {
    if (!requireLogin()) return;
    const u = app.globalData.userInfo;
    const identities = app.globalData.identities || [];
    const labels = identities.map((r) => (r === 'owner' ? '车主' : '乘车人'));
    this.setData({
      userInfo: u,
      phoneText: u.phone || '未绑定 · 可选',
      identitySummary: labels.length ? labels.join('、') : '未设置'
    });
  },

  goIdentityManage() {
    wx.navigateTo({ url: '/pages/identity-manage/identity-manage' });
  },

  viewAgreement() {
    wx.showToast({ title: '协议预览占位', icon: 'none' });
  },

  onLogout() {
    app.logout();
    safeReLaunch('/pages/login/login');
  }
});
