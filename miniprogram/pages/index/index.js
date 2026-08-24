const app = getApp()
const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const { buildPlazaFilterView } = require('../../modules/order/plaza-filter')
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
    filters: { ...EMPTY_FILTERS },
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
    accepting: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    if (!auth.requireLogin()) return
    auth.store.initFromStorage()
    auth.store.syncGlobalData(app.globalData)
    this.loadOrders()
  },

  applyFilterView(allOrders, points, filters) {
    const enriched = enrichOrders(allOrders)
    const view = buildPlazaFilterView(enriched, points, filters)
    this.setData({
      allOrders: enriched,
      points,
      matchedOrders: view.matchedOrders || [],
      otherOrders: view.otherOrders || [],
      filters: view.filters,
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
      this.applyFilterView(rawOrders, points, this.data.filters)
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
    this.updateFilters({
      ...this.data.filters,
      date,
      timeWindow: ''
    })
  },

  onFilterTimeChange(e) {
    const index = Number(e.detail.value)
    const timeWindow = this.data.filterTimeValues[index] || ''
    this.updateFilters({
      ...this.data.filters,
      timeWindow
    })
  },

  onFilterFromChange(e) {
    const index = Number(e.detail.value)
    const fromPointId = this.data.filterFromValues[index] || ''
    this.updateFilters({
      ...this.data.filters,
      fromPointId
    })
  },

  onFilterToChange(e) {
    const index = Number(e.detail.value)
    const toPointId = this.data.filterToValues[index] || ''
    this.updateFilters({
      ...this.data.filters,
      toPointId
    })
  },

  onResetFilters() {
    this.updateFilters({ ...EMPTY_FILTERS })
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

  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' })
  },

  goAddOwnerIdentity() {
    wx.navigateTo({ url: '/pages/onboarding/identity/identity?mode=add' })
  }
})
