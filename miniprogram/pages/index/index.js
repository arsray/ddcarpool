const app = getApp()
const config = require('../../config/index')
const auth = require('../../modules/auth/index')
const order = require('../../modules/order/index')
const notification = require('../../modules/notification/index')
const { DEFAULT_POINTS } = require('../../modules/order/constants/points')
const poiPickerTouch = require('../../modules/order/poi-picker-touch')
const { buildPlazaFilterView, buildDefaultPlazaFilters } = require('../../modules/order/plaza-filter')
const { filterPoints, getPointDisplayName } = require('../../modules/order/point-search')
const { formatDateLabel } = require('../../modules/order/history-bridge')
const { formatHistoryTimeLabel, parseDepartTime } = require('../../modules/order/time-slots')

const { ensureCorrectPlazaPage } = require('../../modules/auth/plaza-tab')
const {
  menuHeightPx,
  measureAnchorRect,
  layoutMenuBelowField,
  poiCursorSpacingPx
} = require('../../modules/ui/inline-menu')

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
  toPointId: '',
  fromQuery: '',
  toQuery: ''
}

function buildAcceptModalFields(orderItem) {
  const departDate = parseDepartTime(orderItem.departTime)
  return {
    dateLabel: departDate ? formatDateLabel(departDate) : (orderItem.departTime || '').slice(0, 10),
    timeLabel: formatHistoryTimeLabel(orderItem) || orderItem.departTimeLabel || ''
  }
}

function enrichOrders(list, points) {
  const pointList = points || []

  return (list || []).map((item) => {
    const { dateLabel, timeLabel } = buildAcceptModalFields(item)

    const fromPoint = pointList.find((point) => point.pointId === item.fromPointId)
    const toPoint = pointList.find((point) => point.pointId === item.toPointId)

    return {
      ...item,
      dateLabel,
      timeLabel,
      fromName: fromPoint ? fromPoint.name : '未知起点',
      toName: toPoint ? toPoint.name : '未知终点'
    }
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
    filterFromQuery: '',
    filterToQuery: '',
    filterFromCursor: -1,
    filterToCursor: -1,
    filterFromSuggestions: [],
    filterToSuggestions: [],
    filterFromDropdownOpen: false,
    filterToDropdownOpen: false,
    filterDateDropdownOpen: false,
    filterTimeDropdownOpen: false,
    inlineMenuHeightPx: 160,
    filterFloatTop: 0,
    filterFloatLeft: 0,
    filterFloatWidth: 0,
    filterFloatItems: [],
    filterFloatField: '',
    keyboardHeightPx: 0,
    filterPoiCursorSpacing: 0,
    filterFromLabels: ['全部'],
    filterFromValues: [''],
    filterFromIndex: 0,
    filterToLabels: ['全部'],
    filterToValues: [''],
    filterToIndex: 0,
    hasActiveFilters: false,
    displayPoolCount: 0,
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
    uiPrototypeMode: false,
    
    userMode: app.globalData.userMode || 'owner',
    
    noticeText: '明晚羽托邦暑假收官战🔥即刻联系xxx报名',
    noticeShouldScroll: false,
    
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
    this.setData({ inlineMenuHeightPx: menuHeightPx(320) })
    this._plazaFiltersTouched = false
    this._plazaFilters = null
    this._plazaHasLoaded = false
    this._loadOrdersInFlight = null
    const warmPoints = this.resolveInitialPoints()
    if (warmPoints.length) {
      this.setData({ points: warmPoints })
    }
    if (config.useCloud) {
      order.listPoints().catch(() => {})
    }

    auth.store.initFromStorage()
    app._syncAuth()
    const identities = app.globalData.identities || []
    const hasOwnerIdentity = identities.includes('owner')
    const isPassengerOnly = identities.includes('passenger') && !hasOwnerIdentity
    if (
      hasOwnerIdentity &&
      app.globalData.userMode !== 'passenger' &&
      auth.store.isLoggedIn()
    ) {
      this.loadOrders()
    }
  },

  onReady() {
    this.checkNoticeOverflow()
  },
  
  checkNoticeOverflow() {
    const query = wx.createSelectorQuery().in(this)
    const isProd = !this.data.uiPrototypeMode
    const scrollSel = isProd ? '.v1-notice-scroll' : '.m2-notice-scroll'
    const contentSel = isProd ? '.v1-notice-content' : '.m2-notice-content'

    query.select(scrollSel).boundingClientRect()
    query.select(contentSel).boundingClientRect()

    query.exec((res) => {
      const container = res[0]
      const content = res[1]

      if (!container || !content) return

      this.setData({
        noticeShouldScroll: content.width > container.width
      })
    })
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
      if (typeof this.getTabBar().refreshPlaza === 'function') {
        this.getTabBar().refreshPlaza()
      }
    }
    notification.syncTabBarBadgeFromApp()

    if (this.data.uiPrototypeMode) {
      this.setData({ loading: false })
      return
    }

    if (!auth.requireLogin()) return
    app._syncAuth()
    ensureCorrectPlazaPage()

    const identities = app.globalData.identities || []
    const hasOwnerIdentity = identities.includes('owner')
    const isPassengerOnly = identities.includes('passenger') && !hasOwnerIdentity

    this.setData({
      userMode: app.globalData.userMode || 'owner',
      hasOwnerIdentity,
      isPassengerOnly
    })

    if (!hasOwnerIdentity || app.globalData.userMode === 'passenger') {
      return
    }

    if (this._loadOrdersInFlight) {
      return
    }

    const hasCachedPlaza = this._plazaHasLoaded && (
      this.data.allOrders.length > 0 ||
      this.data.acceptedOrders.length > 0 ||
      this.data.hasActiveFilters
    )
    this.loadOrders({ silent: hasCachedPlaza })
    this.attachKeyboardListener()
  },

  onHide() {
    this.detachKeyboardListener()
  },

  onUnload() {
    this.detachKeyboardListener()
  },

  attachKeyboardListener() {
    if (this._keyboardHeightListener || typeof wx.onKeyboardHeightChange !== 'function') return
    this._keyboardHeightListener = (res) => {
      const keyboardHeightPx = (res && res.height) || 0
      this.setData({ keyboardHeightPx })
      this.syncFilterFloatMenuLayout()
    }
    wx.onKeyboardHeightChange(this._keyboardHeightListener)
    this.attachKeyboardListener = this.attachKeyboardListener.bind(this)
  },

  detachKeyboardListener() {
    if (this._keyboardHeightListener && typeof wx.offKeyboardHeightChange === 'function') {
      wx.offKeyboardHeightChange(this._keyboardHeightListener)
    }
    this._keyboardHeightListener = null
  },

  async syncFilterFloatMenuLayout() {
    const field = this.data.filterFloatField
    if (field !== 'from' && field !== 'to') return
    if (!this.data.filterFromDropdownOpen && !this.data.filterToDropdownOpen) return
    await this.placeFilterFloatMenu(field)
  },

  async onPullDownRefresh() {
    if (this.data.uiPrototypeMode) {
      wx.stopPullDownRefresh()
      return
    }
    if (!auth.requireLogin()) {
      wx.stopPullDownRefresh()
      return
    }
    app._syncAuth()
    try {
      await this.loadOrders()
    } finally {
      wx.stopPullDownRefresh()
    }
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
    const enriched = enrichOrders(allOrders, points)
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
      filterFromQuery: normalized.fromQuery || '',
      filterToQuery: normalized.toQuery || '',
      filterFromSuggestions: [],
      filterToSuggestions: [],
      filterFromDropdownOpen: false,
      filterToDropdownOpen: false,
      filterDateDropdownOpen: false,
      filterTimeDropdownOpen: false,
      hasActiveFilters: view.hasActiveFilters,
      displayPoolCount: view.hasActiveFilters
        ? (view.matchedOrders || []).length
        : enriched.length
    })
  },

  resolveInitialPoints() {
    const cached = order.getCachedPoints && order.getCachedPoints()
    if (cached && cached.length) return cached
    return DEFAULT_POINTS.filter((point) => point.enabled !== false)
  },

  resolvePointsRefreshTask() {
    const cached = order.getCachedPoints && order.getCachedPoints()
    if (cached && cached.length) {
      return Promise.resolve(cached)
    }
    return order.listPoints()
  },

  async loadOrders(options = {}) {
    if (this._loadOrdersInFlight) {
      return this._loadOrdersInFlight
    }

    const silent = options.silent === true
    const identities = app.globalData.identities || []
    const hasOwnerIdentity = identities.includes('owner')
    const isPassengerOnly = identities.includes('passenger') && !hasOwnerIdentity

    const task = (async () => {
      if (!silent) {
        this.setData({ loading: true, hasOwnerIdentity, isPassengerOnly })
      } else {
        this.setData({ hasOwnerIdentity, isPassengerOnly })
      }
      applyHeroView(this, hasOwnerIdentity, isPassengerOnly, this.data.acceptedOrders)

      if (isPassengerOnly) {
        applyHeroView(this, hasOwnerIdentity, isPassengerOnly, [])
        this.setData({
          matchedOrders: [],
          otherOrders: [],
          allOrders: [],
          acceptedOrders: [],
          loading: false
        })
        return
      }

      order.expireStaleOrders().catch(() => {})

      try {
        let openId = app.globalData.openId
        if (!openId) {
          openId = await auth.ensureLogin()
        }

        let points = this.resolveInitialPoints()
        const rawOrders = await order.listOpenOrders({ viewerOpenId: openId })
        let rawAccepted = []
        let driverActiveFailed = false

        try {
          const [acceptedList, freshPoints] = await Promise.all([
            order.listDriverActiveOrders(openId),
            this.resolvePointsRefreshTask()
          ])
          rawAccepted = acceptedList || []
          if (freshPoints && freshPoints.length) {
            points = freshPoints
          }
        } catch (driverError) {
          driverActiveFailed = true
          console.warn('[plaza] listDriverActive failed', driverError && driverError.code)
        }

        this.applyFilterView(rawOrders, points, this.getPlazaFilters())
        const acceptedOrders = enrichOrders(rawAccepted, points)
        applyHeroView(this, hasOwnerIdentity, isPassengerOnly, acceptedOrders)
        this.setData({ acceptedOrders, points, loading: false })
        this._plazaHasLoaded = true

        if (driverActiveFailed) {
          wx.showToast({
            title: '广场已更新，待出发列表暂不可用',
            icon: 'none'
          })
        }
      } catch (error) {
        const hadPlazaData = (this.data.allOrders || []).length > 0
          || (this.data.acceptedOrders || []).length > 0
        if (!silent) {
          if (!hadPlazaData) {
            applyHeroView(this, hasOwnerIdentity, isPassengerOnly, [])
            this.setData({
              loading: false,
              matchedOrders: [],
              otherOrders: [],
              allOrders: [],
              acceptedOrders: []
            })
          } else {
            this.setData({ loading: false })
          }
          wx.showToast({ title: '加载广场失败', icon: 'none' })
        } else {
          this.setData({ loading: false })
          wx.showToast({ title: '刷新失败', icon: 'none' })
        }
      }
    })()

    this._loadOrdersInFlight = task.finally(() => {
      this._loadOrdersInFlight = null
    })
    return this._loadOrdersInFlight
  },

  updateFilters(nextFilters) {
    this.applyFilterView(this.data.allOrders, this.data.points, nextFilters)
  },

  closeFilterDropdowns(except) {
    const field = except || ''
    this.setData({
      filterDateDropdownOpen: field === 'date',
      filterTimeDropdownOpen: field === 'time',
      filterFromDropdownOpen: field === 'from',
      filterToDropdownOpen: field === 'to',
      filterFloatField: field,
      filterFloatItems: field ? this.buildFilterFloatItems(field) : []
    })
    if (!field) {
      poiPickerTouch.scheduleFloatMenuTouchEnd(this, 0)
    }
  },

  onFilterFloatTouchStart() {
    poiPickerTouch.markFloatMenuTouch(this)
  },

  onFilterFloatTouchEnd() {
    poiPickerTouch.scheduleFloatMenuTouchEnd(this)
  },

  onFilterFloatScroll() {
    poiPickerTouch.markFloatMenuTouch(this)
  },

  buildFilterFloatItems(field) {
    if (field === 'date') {
      return this.data.filterDateLabels.map((label, index) => ({
        key: `date-${index}`,
        label,
        index
      }))
    }
    if (field === 'time') {
      return this.data.filterTimeLabels.map((label, index) => ({
        key: `time-${index}`,
        label,
        index
      }))
    }
    if (field === 'from') {
      return this.data.filterFromSuggestions.map((item) => ({
        key: item.pointId,
        label: item.name,
        pointId: item.pointId
      }))
    }
    if (field === 'to') {
      return this.data.filterToSuggestions.map((item) => ({
        key: item.pointId,
        label: item.name,
        pointId: item.pointId
      }))
    }
    return []
  },

  async openFilterFloatMenu(field) {
    const items = this.buildFilterFloatItems(field)
    if (typeof wx.stopPullDownRefresh === 'function') {
      wx.stopPullDownRefresh()
    }
    this.setData({
      filterFloatField: field,
      filterFloatItems: items,
      filterDateDropdownOpen: field === 'date',
      filterTimeDropdownOpen: field === 'time',
      filterFromDropdownOpen: field === 'from',
      filterToDropdownOpen: field === 'to'
    })
    await this.placeFilterFloatMenu(field)
    if (field === 'from' || field === 'to') {
      setTimeout(() => this.placeFilterFloatMenu(field), 320)
    }
  },

  async placeFilterFloatMenu(field) {
    const selector = `#filter-field-${field}`
    const rect = await measureAnchorRect(this, selector)
    if (!rect) return

    const layout = layoutMenuBelowField(rect)
    this.setData({
      filterFloatTop: layout.top,
      filterFloatLeft: layout.left,
      filterFloatWidth: layout.width
    })
  },

  onFilterFloatPick(e) {
    poiPickerTouch.lockPickerTap(this)
    const { index, id } = e.currentTarget.dataset
    const field = this.data.filterFloatField
    if (field === 'date') {
      this.onFilterDatePick({ currentTarget: { dataset: { index: Number(index) } } })
      return
    }
    if (field === 'time') {
      this.onFilterTimePick({ currentTarget: { dataset: { index: Number(index) } } })
      return
    }
    if (field === 'from') {
      this.onSelectFilterFrom({ currentTarget: { dataset: { id } } })
      return
    }
    if (field === 'to') {
      this.onSelectFilterTo({ currentTarget: { dataset: { id } } })
    }
  },

  onFilterDateOpen() {
    if (this.data.filterDateDropdownOpen) {
      this.closeFilterDropdowns()
      return
    }
    this.openFilterFloatMenu('date')
  },

  onFilterTimeOpen() {
    if (this.data.filterTimeDropdownOpen) {
      this.closeFilterDropdowns()
      return
    }
    this.openFilterFloatMenu('time')
  },

  onFilterDatePick(e) {
    poiPickerTouch.lockPickerTap(this)
    const index = Number(e.currentTarget.dataset.index)
    const date = this.data.filterDateValues[index] || ''
    this.setData({
      filterDateDropdownOpen: false,
      filterFloatField: '',
      filterFloatItems: []
    })
    this.commitPlazaFilters({
      ...this.getPlazaFilters(),
      date,
      timeWindow: ''
    })
  },

  onFilterTimePick(e) {
    poiPickerTouch.lockPickerTap(this)
    const index = Number(e.currentTarget.dataset.index)
    const timeWindow = this.data.filterTimeValues[index] || ''
    this.setData({
      filterTimeDropdownOpen: false,
      filterFloatField: '',
      filterFloatItems: []
    })
    this.commitPlazaFilters({
      ...this.getPlazaFilters(),
      timeWindow
    })
  },

  onFilterFromFocus() {
    this._filterFromRevert = this.getPlazaFilters().fromPointId || ''
    const query = this.data.filterFromQuery || ''
    this.setData({
      filterFromSuggestions: filterPoints(this.data.points, ''),
      filterFromCursor: query.length,
      filterPoiCursorSpacing: poiCursorSpacingPx(this.data.inlineMenuHeightPx)
    }, () => this.openFilterFloatMenu('from'))
  },

  onFilterToFocus() {
    this._filterToRevert = this.getPlazaFilters().toPointId || ''
    const query = this.data.filterToQuery || ''
    this.setData({
      filterToSuggestions: filterPoints(this.data.points, ''),
      filterToCursor: query.length,
      filterPoiCursorSpacing: poiCursorSpacingPx(this.data.inlineMenuHeightPx)
    }, () => this.openFilterFloatMenu('to'))
  },

  onFilterSuggestionTouchStart() {
    poiPickerTouch.onSuggestionTouchStart(this)
  },

  onFilterFromBlur() {
    poiPickerTouch.runAfterBlur(() => {
      if (poiPickerTouch.shouldDeferPoiBlur(this)) {
        if (this._poiPickerTapLock) this._poiPickerTapLock = false
        return
      }

      const points = this.data.points
      const draftQuery = String(this.data.filterFromQuery || '').trim()
      const committed = this.getPlazaFilters()

      if (!draftQuery) {
        this.commitPlazaFilters({
          ...committed,
          fromQuery: '',
          fromPointId: ''
        })
        this.setData({
          filterFromDropdownOpen: false,
          filterFloatField: '',
          filterFloatItems: []
        })
        return
      }

      const revertId = this._filterFromRevert
      this._filterFromRevert = ''
      if (revertId) {
        const point = points.find((item) => item.pointId === revertId)
        if (point) {
          this.setData({
            filterFromQuery: point.name,
            filterFromDropdownOpen: false,
            filterFloatField: '',
            filterFloatItems: []
          })
          return
        }
      }

      this.setData({
        filterFromQuery: committed.fromPointId
          ? getPointDisplayName(points, committed.fromPointId)
          : '',
        filterFromDropdownOpen: false,
        filterFloatField: '',
        filterFloatItems: []
      })
    })
  },

  onFilterToBlur() {
    poiPickerTouch.runAfterBlur(() => {
      if (poiPickerTouch.shouldDeferPoiBlur(this)) {
        if (this._poiPickerTapLock) this._poiPickerTapLock = false
        return
      }

      const points = this.data.points
      const draftQuery = String(this.data.filterToQuery || '').trim()
      const committed = this.getPlazaFilters()

      if (!draftQuery) {
        this.commitPlazaFilters({
          ...committed,
          toQuery: '',
          toPointId: ''
        })
        this.setData({
          filterToDropdownOpen: false,
          filterFloatField: '',
          filterFloatItems: []
        })
        return
      }

      const revertId = this._filterToRevert
      this._filterToRevert = ''
      if (revertId) {
        const point = points.find((item) => item.pointId === revertId)
        if (point) {
          this.setData({
            filterToQuery: point.name,
            filterToDropdownOpen: false,
            filterFloatField: '',
            filterFloatItems: []
          })
          return
        }
      }

      this.setData({
        filterToQuery: committed.toPointId
          ? getPointDisplayName(points, committed.toPointId)
          : '',
        filterToDropdownOpen: false,
        filterFloatField: '',
        filterFloatItems: []
      })
    })
  },

  onFilterFromQueryInput(e) {
    const fromQuery = e.detail.value
    this.setData({
      filterFromQuery: fromQuery,
      filterFromSuggestions: filterPoints(this.data.points, fromQuery),
      filterToDropdownOpen: false
    }, () => {
      if (this.data.filterFromDropdownOpen) {
        this.setData({ filterFloatItems: this.buildFilterFloatItems('from') })
      } else {
        this.openFilterFloatMenu('from')
      }
    })
  },

  onFilterToQueryInput(e) {
    const toQuery = e.detail.value
    this.setData({
      filterToQuery: toQuery,
      filterToSuggestions: filterPoints(this.data.points, toQuery),
      filterFromDropdownOpen: false
    }, () => {
      if (this.data.filterToDropdownOpen) {
        this.setData({ filterFloatItems: this.buildFilterFloatItems('to') })
      } else {
        this.openFilterFloatMenu('to')
      }
    })
  },

  onSelectFilterFrom(e) {
    const pointId = e.currentTarget.dataset.id
    const point = this.data.points.find((item) => item.pointId === pointId)
    if (!point) return
    poiPickerTouch.lockPickerTap(this)
    this.setData({
      filterFromQuery: point.name,
      filterFromSuggestions: filterPoints(this.data.points, ''),
      filterFromDropdownOpen: false,
      filterToDropdownOpen: false,
      filterFloatField: '',
      filterFloatItems: []
    })
    this.commitPlazaFilters({
      ...this.getPlazaFilters(),
      fromQuery: point.name,
      fromPointId: point.pointId
    })
  },

  onSelectFilterTo(e) {
    const pointId = e.currentTarget.dataset.id
    const point = this.data.points.find((item) => item.pointId === pointId)
    if (!point) return
    poiPickerTouch.lockPickerTap(this)
    this.setData({
      filterToQuery: point.name,
      filterToSuggestions: filterPoints(this.data.points, ''),
      filterToDropdownOpen: false,
      filterFromDropdownOpen: false,
      filterFloatField: '',
      filterFloatItems: []
    })
    this.commitPlazaFilters({
      ...this.getPlazaFilters(),
      toQuery: point.name,
      toPointId: point.pointId
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

      app._syncAuth()

      wx.showToast({ title: '接单成功', icon: 'success' })
      this.resetAcceptModal()
      await this.loadOrders({ silent: true })
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
      url: `/pages/detail/detail?orderId=${orderId}&role=owner&from=plaza`
    })
  },
  async switchUserMode(e) {
    const mode = e.currentTarget.dataset.mode
    if (!mode || mode === this.data.userMode) return
  
    try {
      await app.setUserMode(mode)
      this.setData({ userMode: app.globalData.userMode })
      await this.loadOrders()
    } catch (error) {
      wx.showToast({ title: '切换身份失败', icon: 'none' })
    }
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
    wx.showModal({
      title: '添加车主身份',
      content: '添加后可在「我的」中切换车主模式，是否继续？',
      confirmText: '添加',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.addIdentity('owner')
          wx.navigateTo({ url: '/pages/vehicle/vehicle?setup=1' })
        } catch (error) {
          wx.showToast({ title: '添加身份失败，请重试', icon: 'none' })
        }
      }
    })
  }
})
