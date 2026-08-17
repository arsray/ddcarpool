const app = getApp();
const auth = require('../../modules/auth/index');
const {
  COMMON_BRANDS,
  BRAND_GROUPS,
  INDEX_LETTERS,
  COMMON_PLATE_PREFIXES,
  PLATE_PREFIX_GROUPS,
  VEHICLE_COLORS,
  validatePlateSuffix
} = require('../../modules/auth/vehicle-data');

function buildCapacityRange() {
  return Array.from({ length: 21 }, (_, i) => i);
}

Page({
  data: {
    form: {
      brand: '',
      modelType: 'SUV',
      platePrefix: '',
      plateSuffix: '',
      passengerCapacity: 4,
      color: '白色',
      colorCustom: ''
    },
    onboarding: false,
    setup: false,
    capacityRange: buildCapacityRange(),
    capacityIndex: 4,
    colorOptions: VEHICLE_COLORS,
    colorCustom: false,
    commonBrands: COMMON_BRANDS,
    brandGroups: BRAND_GROUPS,
    indexLetters: INDEX_LETTERS,
    commonPrefixes: COMMON_PLATE_PREFIXES,
    prefixGroups: PLATE_PREFIX_GROUPS,
    showBrandPicker: false,
    showPrefixPicker: false,
    brandScrollInto: ''
  },

  onLoad(options) {
    this.setData({
      onboarding: options.onboarding === '1',
      setup: options.setup === '1'
    });
  },

  onShow() {
    if (!auth.requireLogin()) return;
    const vehicle = app.globalData.vehicle || {};
    const platePrefix = vehicle.platePrefix || vehicle.plateProvince || (vehicle.plate ? vehicle.plate.charAt(0) : '');
    const plateSuffix = vehicle.plateSuffix || (vehicle.plate ? vehicle.plate.slice(1) : '');
    const color = vehicle.color || '白色';
    const isOther = color && !VEHICLE_COLORS.slice(0, -1).includes(color);
    this.setData({
      form: {
        brand: vehicle.brand || '',
        modelType: vehicle.modelType || 'SUV',
        platePrefix,
        plateSuffix,
        passengerCapacity: vehicle.passengerCapacity ?? 4,
        color: isOther ? '其他' : color,
        colorCustom: isOther ? color : ''
      },
      capacityIndex: vehicle.passengerCapacity ?? 4,
      colorCustom: isOther
    });
  },

  noop() {},

  onModelChange(e) {
    this.setData({ 'form.modelType': e.detail.value });
  },

  onPlateSuffixInput(e) {
    this.setData({ 'form.plateSuffix': e.detail.value.toUpperCase() });
  },

  onCapacityChange(e) {
    const index = Number(e.detail.value);
    this.setData({
      capacityIndex: index,
      'form.passengerCapacity': this.data.capacityRange[index]
    });
  },

  onColorSelect(e) {
    const color = e.currentTarget.dataset.color;
    if (color === '其他') {
      this.setData({ colorCustom: true, 'form.color': '其他', 'form.colorCustom': '' });
      return;
    }
    this.setData({ colorCustom: false, 'form.color': color, 'form.colorCustom': '' });
  },

  onColorCustomInput(e) {
    this.setData({ 'form.colorCustom': e.detail.value });
  },

  openBrandPicker() {
    this.setData({ showBrandPicker: true });
  },

  closeBrandPicker() {
    this.setData({ showBrandPicker: false });
  },

  selectBrand(e) {
    const brand = e.currentTarget.dataset.brand;
    this.setData({ 'form.brand': brand, showBrandPicker: false });
  },

  scrollToLetter(e) {
    this.setData({ brandScrollInto: `brand-${e.currentTarget.dataset.letter}` });
  },

  openPrefixPicker() {
    this.setData({ showPrefixPicker: true });
  },

  closePrefixPicker() {
    this.setData({ showPrefixPicker: false });
  },

  selectPrefix(e) {
    const abbr = e.currentTarget.dataset.abbr;
    this.setData({ 'form.platePrefix': abbr, showPrefixPicker: false });
  },

  onSave() {
    const form = { ...this.data.form };
    if (!form.brand) {
      wx.showToast({ title: '请选择品牌', icon: 'none' });
      return;
    }
    if (!form.platePrefix) {
      wx.showToast({ title: '请选择地区', icon: 'none' });
      return;
    }
    const plateCheck = validatePlateSuffix(form.plateSuffix);
    if (!plateCheck.ok) {
      wx.showToast({ title: plateCheck.message, icon: 'none' });
      return;
    }
    if (form.color === '其他' && !form.colorCustom.trim()) {
      wx.showToast({ title: '请输入其他颜色', icon: 'none' });
      return;
    }

    const finalColor = form.color === '其他' ? form.colorCustom.trim() : form.color;
    const payload = {
      brand: form.brand,
      modelType: form.modelType,
      platePrefix: form.platePrefix,
      plateSuffix: plateCheck.suffix,
      plate: `${form.platePrefix}${plateCheck.suffix}`,
      passengerCapacity: form.passengerCapacity,
      color: finalColor
    };

    app.saveVehicle(payload);
    let title = '已保存';
    if (this.data.setup) title = '车主身份已添加';
    else if (this.data.onboarding) title = '车主信息已保存';
    this.finishGuide(title);
  },

  onSkip() {
    this.finishGuide('可稍后在「我的」中填写车辆');
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
