const app = getApp()
const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const { buildPlazaFilterView, buildDefaultPlazaFilters } = require('../../modules/order/plaza-filter')
const { formatDateLabel } = require('../../modules/order/history-bridge')
const { formatHistoryTimeLabel, parseDepartTime } = require('../../modules/order/time-slots')

const ACCEPT_ERROR_MESSAGES = {
  ORDER_NOT_FOUND: '订单不存在',
  INVALID_STATUS: '订单当前不可接单',
  SELF_ACCEPT: '不能接自己的单',
  ALREADY_ACCEPTED: '订单已被接单',
  NOT_LOGGED_IN: '请先登录'
}

const EMPTY_FILTERS = {
  date: '',
  timeWindow: '',
  fromPointId: '',
  toPointId: ''
}

function buildAcceptModalFields(orderItem) {
  const departDate = parseDepartTime(orderItem.departTime)
  return {
    dateLabel: departDate ? formatDateLabel(departDate) : (orderItem.departTime || '').slice(0, 10),
    timeLabel: formatHistoryTimeLabel(orderItem) || orderItem.departTimeLabel || ''
  }
}

function enrichOrders(list) {
  return (list || []).map((item) => {
    const { dateLabel, timeLabel } = buildAcceptModalFields(item)
    return { ...item, dateLabel, timeLabel }
  })
}

function buildHeroView(hasOwnerIdentity, isPassengerOnly, acceptedOrders) {
  const heroTitle = '广场'
  if (isPassengerOnly || !hasOwnerIdentity) {
    return {
      heroTitle,
      heroDesc: '搭车单请前往「发布」；广场供司机浏览接单。',
      heroTodoHint: ''
    }
  }

  const accepted = acceptedOrders || []
  if (!accepted.length) {
    return {
      heroTitle,
      heroDesc: '浏览顺路搭车单并接单，接单后可在上方查看待出发行程。',
      heroTodoHint: ''
    }
  }

  const count = accepted.length
  const earliest = accepted[0]
  const when = [earliest.dateLabel, earliest.timeLabel].filter(Boolean).join(' · ')
  const detail = [count > 1 && when ? `最早 ${when}` : when, earliest.routeLabel].filter(Boolean).join(' ')
  return {
    heroTitle,
    heroDesc: '请留意上方待出发行程，下方可筛选并继续接新单。',
    heroTodoHint: `您有 ${count} 单待出发${detail ? ` · ${detail}` : ''}`
  }
}

function applyHeroView(page, hasOwnerIdentity, isPassengerOnly, acceptedOrders) {
  page.setData(buildHeroView(hasOwnerIdentity, isPassengerOnly, acceptedOrders))
}

Page({
  data: {
    loading: true,
    acceptedOrders: [],
    allOrders: [],
    points: [],
    matchedOrders: [],
    otherOrders: [],
    filters: buildDefaultPlazaFilters(),
    filtersTouched: false,
    filterDateLabels: ['全部'],
    filterDateValues: [''],
    filterDateIndex: 0,
    filterTimeLabels: ['全部'],
    filterTimeValues: [''],
    filterTimeIndex: 0,
    filterFromLabels: ['全部'],
    filterFromValues: [''],
    filterFromIndex: 0,
    filterToLabels: ['全部'],
    filterToValues: [''],
    filterToIndex: 0,
    hasActiveFilters: false,
    hasOwnerIdentity: false,
    isPassengerOnly: false,
    heroTitle: '广场',
    heroDesc: '',
    heroTodoHint: '',
    acceptModalVisible: false,
    acceptModalOrder: null,
    acceptDateLabel: '',
    acceptTimeLabel: '',
    accepting: false,

    // ===== M2 Homepage UI Prototype =====
    uiPrototypeMode: true,
    
    homeMode: 'driver',
    
    noticeText: '明晚羽托邦暑假收官战🔥 名额有限！即刻联系xxx报名',
    
    prototypePoints: [
      '米奇大街',
      '演职人员活动中心',
      'TD',
      'PAB',
      '梦幻世界',
      '申迪',
      '羽毛球馆'
    ],
    
    driverTripFromIndex: 2,
    driverTripToIndex: 5,
    driverTripTime: '今天 18:30',
    
    passengerFromIndex: 3,
    passengerToIndex: 6,
    passengerTime: '明天 18:30',
    passengerCount: 1,
    
    prototypeOrders: [
      {
        id: 'prototype-1',
        time: '今天 12:00',
        from: 'TD',
        to: '申迪',
        passengerCount: 1,
        matchScore: 82,
        tags: ['需准时', '不要特斯拉']
      },
      {
        id: 'prototype-2',
        time: '今天 15:00',
        from: '演职人员活动中心',
        to: 'PAB',
        passengerCount: 2,
        matchScore: 76,
        tags: ['行李多']
      },
      {
        id: 'prototype-3',
        time: '明天 18:30',
        from: 'PAB',
        to: '羽毛球馆',
        passengerCount: 1,
        matchScore: 100,
        tags: ['需要理想车型']
      }
    ],
    
    passengerTags: [
      '需准时',
      '行李多',
      '不要特斯拉',
      '需要理想车型'
    ],
    
    rankingTab: 'today',
    rankingUnlocked: false,
    promoVisible: false,
    
    todayRanking: [
      { rank: 1, maskedName: 'G**师傅', name: '高师傅', merit: 12 },
      { rank: 2, maskedName: 'S**师傅', name: '孙师傅', merit: 9 },
      { rank: 3, maskedName: 'W**师傅', name: '王师傅', merit: 7 },
      { rank: 4, maskedName: 'L**师傅', name: '李师傅', merit: 6 },
      { rank: 5, maskedName: 'Z**师傅', name: '张师傅', merit: 5 },
      { rank: 6, maskedName: 'C**师傅', name: '陈师傅', merit: 3 }
    ],
    
    totalRanking: [
      { rank: 1, maskedName: 'G**师傅', name: '高师傅', merit: 386 },
      { rank: 2, maskedName: 'W**师傅', name: '王师傅', merit: 342 },
      { rank: 3, maskedName: 'S**师傅', name: '孙师傅', merit: 315 },
      { rank: 4, maskedName: 'L**师傅', name: '李师傅', merit: 288 },
      { rank: 5, maskedName: 'Z**师傅', name: '张师傅', merit: 261 },
      { rank: 6, maskedName: 'C**师傅', name: '陈师傅', merit: 240 }
    ]
  },

  onLoad() {
    this._plazaFiltersTouched = false
    this._plazaFilters = null
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  
    // M2 Homepage UI Prototype：仅用于本地 UI 预览
    if (this.data.uiPrototypeMode) {
      this.setData({ loading: false })
      return
    }
  
    if (!auth.requireLogin()) return
    auth.store.initFromStorage()
    auth.store.syncGlobalData(app.globalData)
    this.loadOrders()
  },

  getPlazaFilters() {
    if (this._plazaFiltersTouched) {
      return this._plazaFilters || this.data.filters || { ...EMPTY_FILTERS }
    }
    return buildDefaultPlazaFilters()
  },

  commitPlazaFilters(nextFilters) {
    this._plazaFiltersTouched = true
    this._plazaFilters = { ...nextFilters }
    this.updateFilters(this._plazaFilters)
  },

  applyFilterView(allOrders, points, filters) {
    const enriched = enrichOrders(allOrders)
    const view = buildPlazaFilterView(enriched, points, filters, new Date())
    const normalized = view.filters
    if (this._plazaFiltersTouched) {
      this._plazaFilters = normalized
    }
    this.setData({
      allOrders: enriched,
      points,
      matchedOrders: view.matchedOrders || [],
      otherOrders: view.otherOrders || [],
      filters: normalized,
      filtersTouched: !!this._plazaFiltersTouched,
      filterDateLabels: view.filterDateLabels,
      filterDateValues: view.filterDateValues,
      filterDateIndex: view.filterDateIndex,
      filterTimeLabels: view.filterTimeLabels,
      filterTimeValues: view.filterTimeValues,
      filterTimeIndex: view.filterTimeIndex,
      filterFromLabels: view.filterFromLabels,
      filterFromValues: view.filterFromValues,
      filterFromIndex: view.filterFromIndex,
      filterToLabels: view.filterToLabels,
      filterToValues: view.filterToValues,
      filterToIndex: view.filterToIndex,
      hasActiveFilters: view.hasActiveFilters
    })
  },

  async loadOrders() {
    const identities = app.globalData.identities || []
    const hasOwnerIdentity = identities.includes('owner')
    const isPassengerOnly = identities.includes('passenger') && !hasOwnerIdentity

    this.setData({ loading: true, hasOwnerIdentity, isPassengerOnly })
    applyHeroView(this, hasOwnerIdentity, isPassengerOnly, this.data.acceptedOrders)

    if (isPassengerOnly) {
      applyHeroView(this, hasOwnerIdentity, isPassengerOnly, [])
      this.setData({ matchedOrders: [], otherOrders: [], allOrders: [], acceptedOrders: [], loading: false })
      return
    }

    try {
      await order.expireStaleOrders()
      const openId = app.globalData.openId || (await auth.ensureLogin())
      const [rawOrders, rawAccepted] = await Promise.all([
        order.listOpenOrders({ viewerOpenId: openId }),
        order.listDriverActiveOrders(openId)
      ])
      const points = await order.listPoints()
      this.applyFilterView(rawOrders, points, this.getPlazaFilters())
      const acceptedOrders = enrichOrders(rawAccepted)
      applyHeroView(this, hasOwnerIdentity, isPassengerOnly, acceptedOrders)
      this.setData({
        acceptedOrders,
        loading: false
      })
    } catch (error) {
      applyHeroView(this, hasOwnerIdentity, isPassengerOnly, [])
      this.setData({ loading: false, matchedOrders: [], otherOrders: [], allOrders: [], acceptedOrders: [] })
      wx.showToast({ title: '加载广场失败', icon: 'none' })
    }
  },

  updateFilters(nextFilters) {
    this.applyFilterView(this.data.allOrders, this.data.points, nextFilters)
  },

  onFilterDateChange(e) {
    const index = Number(e.detail.value)
    const date = this.data.filterDateValues[index] || ''
    this.commitPlazaFilters({
      ...this.getPlazaFilters(),
      date,
      timeWindow: ''
    })
  },

  onFilterTimeChange(e) {
    const index = Number(e.detail.value)
    const timeWindow = this.data.filterTimeValues[index] || ''
    this.commitPlazaFilters({
      ...this.getPlazaFilters(),
      timeWindow
    })
  },

  onFilterFromChange(e) {
    const index = Number(e.detail.value)
    const fromPointId = this.data.filterFromValues[index] || ''
    this.commitPlazaFilters({
      ...this.getPlazaFilters(),
      fromPointId
    })
  },

  onFilterToChange(e) {
    const index = Number(e.detail.value)
    const toPointId = this.data.filterToValues[index] || ''
    this.commitPlazaFilters({
      ...this.getPlazaFilters(),
      toPointId
    })
  },

  onResetFilters() {
    this.commitPlazaFilters({ ...EMPTY_FILTERS })
  },

  noop() {},

  findOrderById(orderId) {
    const matched = (this.data.matchedOrders || []).find((item) => item._id === orderId)
    if (matched) return matched
    return (this.data.otherOrders || []).find((item) => item._id === orderId) || null
  },

  onOpenAccept(e) {
    const orderId = e.currentTarget.dataset.id
    const orderItem = this.findOrderById(orderId)
    if (!orderItem) return

    const { dateLabel, timeLabel } = buildAcceptModalFields(orderItem)
    this.setData({
      acceptModalVisible: true,
      acceptModalOrder: orderItem,
      acceptDateLabel: dateLabel,
      acceptTimeLabel: timeLabel
    })
  },

  closeAcceptModal() {
    if (this.data.accepting) return
    this.resetAcceptModal()
  },

  resetAcceptModal() {
    this.setData({
      acceptModalVisible: false,
      acceptModalOrder: null,
      acceptDateLabel: '',
      acceptTimeLabel: ''
    })
  },

  async confirmAccept() {
    const orderItem = this.data.acceptModalOrder
    if (!orderItem || this.data.accepting) return

    this.setData({ accepting: true })
    try {
      const openId = await auth.ensureLogin()
      const profile = await auth.getProfile()
      await order.acceptOrder(orderItem._id, {
        openId,
        name: (profile && profile.nickName) || app.globalData.userInfo.displayName || '司机'
      })

      auth.store.initFromStorage()
      auth.store.syncGlobalData(app.globalData)

      wx.showToast({ title: '接单成功', icon: 'success' })
      this.resetAcceptModal()
      await this.loadOrders()
    } catch (error) {
      wx.showToast({
        title: ACCEPT_ERROR_MESSAGES[error.code] || error.message || '接单失败',
        icon: 'none'
      })
      await this.loadOrders()
    } finally {
      this.setData({ accepting: false })
    }
  },

  goAcceptedDetail(e) {
    const orderId = e.currentTarget.dataset.id
    if (!orderId) return
    wx.navigateTo({
      url: `/pages/detail/detail?orderId=${orderId}&from=plaza`
    })
  },
  switchHomeMode(e) {
    this.setData({
      homeMode: e.currentTarget.dataset.mode
    })
  },
  
  switchRankingTab(e) {
    this.setData({
      rankingTab: e.currentTarget.dataset.tab
    })
  },
  
  onDriverFromChange(e) {
    this.setData({
      driverTripFromIndex: Number(e.detail.value)
    })
  },
  
  onDriverToChange(e) {
    this.setData({
      driverTripToIndex: Number(e.detail.value)
    })
  },
  
  onPassengerFromChange(e) {
    this.setData({
      passengerFromIndex: Number(e.detail.value)
    })
  },
  
  onPassengerToChange(e) {
    this.setData({
      passengerToIndex: Number(e.detail.value)
    })
  },
  
  showPrototypeMatch() {
    wx.showToast({
      title: 'UI 演示：匹配功能待联调',
      icon: 'none'
    })
  },
  
  showPrototypePublish() {
    wx.showToast({
      title: 'UI 演示：发布功能待联调',
      icon: 'none'
    })
  },
  
  showPrototypeAccept() {
    wx.showToast({
      title: 'UI 演示：接单功能沿用 M3',
      icon: 'none'
    })
  },
  
  openPromoModal() {
    this.setData({
      promoVisible: true
    })
  },
  
  closePromoModal() {
    this.setData({
      promoVisible: false
    })
  },
  
  completePromo() {
    this.setData({
      promoVisible: false,
      rankingUnlocked: true
    })
  
    wx.showToast({
      title: '今日排行榜已解锁',
      icon: 'success'
    })
  },
  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' })
  },
  switchHomeMode(e) {
    this.setData({
      homeMode: e.currentTarget.dataset.mode
    })
  },
  
  switchRankingTab(e) {
    this.setData({
      rankingTab: e.currentTarget.dataset.tab
    })
  },
  
  onDriverFromChange(e) {
    this.setData({
      driverTripFromIndex: Number(e.detail.value)
    })
  },
  
  onDriverToChange(e) {
    this.setData({
      driverTripToIndex: Number(e.detail.value)
    })
  },
  
  onPassengerFromChange(e) {
    this.setData({
      passengerFromIndex: Number(e.detail.value)
    })
  },
  
  onPassengerToChange(e) {
    this.setData({
      passengerToIndex: Number(e.detail.value)
    })
  },
  
  showPrototypeMatch() {
    wx.showToast({
      title: 'UI 演示：匹配功能待联调',
      icon: 'none'
    })
  },
  
  showPrototypePublish() {
    wx.showToast({
      title: 'UI 演示：发布功能待联调',
      icon: 'none'
    })
  },
  
  showPrototypeAccept() {
    wx.showToast({
      title: 'UI 演示：接单功能沿用 M3',
      icon: 'none'
    })
  },
  
  openPromoModal() {
    this.setData({
      promoVisible: true
    })
  },
  
  closePromoModal() {
    this.setData({
      promoVisible: false
    })
  },
  
  completePromo() {
    this.setData({
      promoVisible: false,
      rankingUnlocked: true
    })
  
    wx.showToast({
      title: '今日排行榜已解锁',
      icon: 'success'
    })
  },
  goAddOwnerIdentity() {
    wx.navigateTo({ url: '/pages/onboarding/identity/identity?mode=add' })
  }
})
