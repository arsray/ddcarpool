const app = getApp()
const auth = require('../../modules/auth/index')
const { ensureCorrectPlazaPage } = require('../../modules/auth/plaza-tab')
const order = require('../../modules/order/index')
const notification = require('../../modules/notification/index')
const { PREFERENCE_NOTE_TAGS } = require('../../modules/auth/vehicle-data')
const { MAX_NOTE_LENGTH, buildDatePickerOptions } = require('../../modules/order/validate')
const {
  buildAvailableSlotsForDate,
  formatDepartTimeForStorage
} = require('../../modules/order/time-slots')
const { filterPoints, getPointDisplayName } = require('../../modules/order/point-search')
const poiPickerTouch = require('../../modules/order/poi-picker-touch')
const {
  menuHeightPx,
  measureAnchorRect,
  layoutMenuBelowField
} = require('../../modules/ui/inline-menu')
const {
  consumeRepublishDraft,
  consumeEditOrderDraft,
  applyRepublishDraft,
  applyEditOrderDraft
} = require('../../modules/order/republish-draft')

const COUNT_RANGE = Array.from({ length: 10 }, (_, index) => index + 1)

function pickInitialSchedule(dateValues, now) {
  for (let index = 0; index < dateValues.length; index += 1) {
    const slots = buildAvailableSlotsForDate(dateValues[index], now)
    if (slots.length) {
      return {
        dateIndex: index,
        date: dateValues[index],
        slots
      }
    }
  }
  return {
    dateIndex: 0,
    date: dateValues[0],
    slots: buildAvailableSlotsForDate(dateValues[0], now)
  }
}

function buildSlotViewState(dateStr, now) {
  const slots = buildAvailableSlotsForDate(dateStr, now)
  const selectedSlot = slots[0] || null
  return {
    timeSlots: slots,
    timeLabels: slots.map((slot) => slot.label),
    timeIndex: 0,
    selectedSlot,
    hasAvailableSlots: slots.length > 0,
    formTimeWindow: selectedSlot ? selectedSlot.label : ''
  }
}

function buildSelectedNoteMap(noteTags) {
  const selectedNoteMap = {}
  ;(noteTags || []).forEach((tag) => {
    selectedNoteMap[tag] = true
  })
  return selectedNoteMap
}

function buildSubmitNote(selectedNoteMap, supplementNote) {
  const noteTags = Object.keys(selectedNoteMap || {}).filter((key) => selectedNoteMap[key])
  const parts = noteTags.slice()
  const extra = (supplementNote || '').trim()
  if (extra) parts.push(extra)
  return parts.join(' · ')
}

function readPassengerPreference() {
  app._syncAuth()
  return app.globalData.preference || {
    defaultCount: 1,
    note: '',
    noteTags: []
  }
}

Page({
  data: {
    hasPassengerIdentity: false,
    editMode: false,
    editingOrderId: '',
    pageTitle: '发布我的行程',
    pageSub: '填写出发信息，发布搭车需求',
    submitLabel: '发布行程',
    loading: true,
    submitting: false,
    dateDropdownOpen: false,
    timeDropdownOpen: false,
    countDropdownOpen: false,
    points: [],
    fromQuery: '',
    toQuery: '',
    fromCursor: -1,
    toCursor: -1,
    fromSuggestions: [],
    toSuggestions: [],
    fromDropdownOpen: false,
    toDropdownOpen: false,
    fromIndex: -1,
    toIndex: -1,
    hasSelectedFrom: false,
    hasSelectedTo: false,
    dateValues: [],
    dateLabels: [],
    dateIndex: 0,
    timeSlots: [],
    timeLabels: [],
    timeIndex: 0,
    selectedSlot: null,
    hasAvailableSlots: false,
    countRange: COUNT_RANGE,
    countIndex: 0,
    noteTags: PREFERENCE_NOTE_TAGS,
    selectedNoteMap: {},
    form: {
      fromPointId: '',
      toPointId: '',
      date: '',
      timeWindow: '',
      passengerCount: 1,
      note: ''
    },
    routePreview: '',
    maxNoteLength: MAX_NOTE_LENGTH,
    noteLength: 0,
    inlineMenuHeightPx: 180,
    publishFloatTop: 0,
    publishFloatLeft: 0,
    publishFloatWidth: 0,
    publishFloatItems: [],
    publishFloatField: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
      if (typeof this.getTabBar().refreshPlaza === 'function') {
        this.getTabBar().refreshPlaza()
      }
    }
    notification.syncTabBarBadgeFromApp()
    if (!auth.requireLogin()) return
    if (this._returningFromPreference) {
      this._returningFromPreference = false
      this.refreshPreferenceFields()
      return
    }
    app._syncAuth()
    ensureCorrectPlazaPage()
    this.bootstrap()
  },

  refreshPreferenceFields() {
    const preference = readPassengerPreference()
    const selectedNoteMap = buildSelectedNoteMap(preference.noteTags)
    const supplementNote = preference.note || ''
    const countIndex = Math.max(0, (preference.defaultCount || 1) - 1)
    this.setData({
      countIndex,
      selectedNoteMap,
      'form.passengerCount': COUNT_RANGE[countIndex],
      'form.note': supplementNote,
      noteLength: supplementNote.length
    })
  },

  async bootstrap() {
    const hasPassengerIdentity = app.hasIdentity('passenger')
    this.setData({
      hasPassengerIdentity,
      loading: true,
      inlineMenuHeightPx: menuHeightPx(360)
    })

    if (!hasPassengerIdentity) {
      this.setData({ loading: false })
      return
    }

    try {
      if (auth.getProfile) {
        await auth.getProfile()
      }
      const preference = readPassengerPreference()
      const editDraft = consumeEditOrderDraft()
      const republishDraft = consumeRepublishDraft()
      let selectedNoteMap = buildSelectedNoteMap(preference.noteTags)
      let supplementNote = preference.note || ''
      let countIndex = Math.max(0, (preference.defaultCount || 1) - 1)

      const points = await order.listPoints()
      const { values: dateValues, labels: dateLabels } = buildDatePickerOptions(new Date())
      const schedule = pickInitialSchedule(dateValues, new Date())
      let slotState = buildSlotViewState(schedule.date, new Date())
      let dateIndex = schedule.dateIndex
      let formDate = schedule.date
      let formTimeWindow = slotState.formTimeWindow

      let fromIndex = -1
      let toIndex = -1
      let hasSelectedFrom = false
      let hasSelectedTo = false
      let fromPointId = ''
      let toPointId = ''
      let editMode = false
      let editingOrderId = ''

      const editApplied = editDraft
        ? applyEditOrderDraft(editDraft, points, COUNT_RANGE, dateValues, { buildSlotViewState })
        : null
      if (editApplied) {
        editMode = true
        editingOrderId = editApplied.orderId
        fromIndex = editApplied.fromIndex
        toIndex = editApplied.toIndex
        hasSelectedFrom = editApplied.hasSelectedFrom
        hasSelectedTo = editApplied.hasSelectedTo
        fromPointId = editApplied.fromPointId
        toPointId = editApplied.toPointId
        countIndex = editApplied.countIndex
        selectedNoteMap = editApplied.selectedNoteMap
        supplementNote = editApplied.supplementNote
        dateIndex = editApplied.dateIndex
        formDate = editApplied.formDate
        formTimeWindow = editApplied.formTimeWindow
        slotState = {
          timeSlots: editApplied.timeSlots,
          timeLabels: editApplied.timeLabels,
          timeIndex: editApplied.timeIndex,
          selectedSlot: editApplied.selectedSlot,
          hasAvailableSlots: editApplied.hasAvailableSlots,
          formTimeWindow: editApplied.formTimeWindow
        }
      } else {
        const republish = applyRepublishDraft(republishDraft, points, COUNT_RANGE)
        if (republish) {
          fromIndex = republish.fromIndex
          toIndex = republish.toIndex
          hasSelectedFrom = republish.hasSelectedFrom
          hasSelectedTo = republish.hasSelectedTo
          fromPointId = republish.fromPointId
          toPointId = republish.toPointId
          countIndex = republish.countIndex
          selectedNoteMap = republish.selectedNoteMap
          supplementNote = republish.supplementNote
        }
      }

      const nextData = {
        points,
        dateValues,
        dateLabels,
        editMode,
        editingOrderId,
        pageTitle: editMode ? '编辑我的行程' : '发布我的行程',
        pageSub: editMode ? '修改出发信息，保存后继续匹配' : '填写出发信息，发布搭车需求',
        submitLabel: editMode ? '保存修改' : '发布行程',
        dateIndex,
        countIndex,
        dateDropdownOpen: false,
        timeDropdownOpen: false,
        countDropdownOpen: false,
        fromIndex,
        toIndex,
        fromQuery: hasSelectedFrom ? getPointDisplayName(points, fromPointId) : '',
        toQuery: hasSelectedTo ? getPointDisplayName(points, toPointId) : '',
        fromSuggestions: filterPoints(points, ''),
        toSuggestions: filterPoints(points, ''),
        fromDropdownOpen: false,
        toDropdownOpen: false,
        hasSelectedFrom,
        hasSelectedTo,
        routePreview: hasSelectedFrom && hasSelectedTo
          ? order.formatRoute(fromPointId, toPointId, points)
          : '',
        selectedNoteMap,
        ...slotState,
        form: {
          fromPointId,
          toPointId,
          date: formDate,
          timeWindow: formTimeWindow,
          passengerCount: COUNT_RANGE[countIndex],
          note: supplementNote
        },
        noteLength: supplementNote.length,
        loading: false
      }

      this.setData(nextData, () => this.refreshRoutePreview())
    } catch (error) {
      this.setData({ loading: false })
      const code = error && error.code
      if (code === 'SESSION_INVALID' || code === 'NOT_LOGGED_IN') {
        wx.showToast({ title: '登录已失效，请重新登录', icon: 'none' })
        return
      }
      wx.showToast({ title: '加载失败，请重试', icon: 'none' })
    }
  },

  refreshRoutePreview() {
    const { form, hasSelectedFrom, hasSelectedTo } = this.data
    if (!hasSelectedFrom || !hasSelectedTo || !form.fromPointId || !form.toPointId) {
      this.setData({ routePreview: '' })
      return
    }
    this.setData({
      routePreview: order.formatRoute(form.fromPointId, form.toPointId, this.data.points)
    })
  },

  selectFromPoint(point) {
    if (!point) return
    poiPickerTouch.lockPickerTap(this)
    const fromIndex = this.data.points.findIndex((item) => item.pointId === point.pointId)
    this.setData({
      fromIndex,
      fromQuery: point.name,
      fromSuggestions: filterPoints(this.data.points, ''),
      fromDropdownOpen: false,
      toDropdownOpen: false,
      publishFloatField: '',
      publishFloatItems: [],
      hasSelectedFrom: true,
      'form.fromPointId': point.pointId
    }, () => this.refreshRoutePreview())
  },

  selectToPoint(point) {
    if (!point) return
    poiPickerTouch.lockPickerTap(this)
    const toIndex = this.data.points.findIndex((item) => item.pointId === point.pointId)
    this.setData({
      toIndex,
      toQuery: point.name,
      toSuggestions: filterPoints(this.data.points, ''),
      toDropdownOpen: false,
      fromDropdownOpen: false,
      publishFloatField: '',
      publishFloatItems: [],
      hasSelectedTo: true,
      'form.toPointId': point.pointId
    }, () => this.refreshRoutePreview())
  },

  onFromFocus() {
    this._fromRevertPointId = this.data.hasSelectedFrom ? this.data.form.fromPointId : ''
    const fromQuery = this.data.fromQuery || ''
    this.setData({
      fromSuggestions: filterPoints(this.data.points, ''),
      fromCursor: fromQuery.length
    }, () => this.openPublishFloatMenu('from'))
  },

  onToFocus() {
    this._toRevertPointId = this.data.hasSelectedTo ? this.data.form.toPointId : ''
    const toQuery = this.data.toQuery || ''
    this.setData({
      toSuggestions: filterPoints(this.data.points, ''),
      toCursor: toQuery.length
    }, () => this.openPublishFloatMenu('to'))
  },

  onPoiSuggestionTouchStart() {
    poiPickerTouch.onSuggestionTouchStart(this)
  },

  onFromBlur() {
    poiPickerTouch.runAfterBlur(() => {
      if (poiPickerTouch.shouldDeferPoiBlur(this)) {
        if (this._poiPickerTapLock) this._poiPickerTapLock = false
        return
      }
      const { hasSelectedFrom, form, points } = this.data
      if (hasSelectedFrom && form.fromPointId) {
        this.setData({
          fromQuery: getPointDisplayName(points, form.fromPointId),
          fromDropdownOpen: false,
          publishFloatField: '',
          publishFloatItems: []
        })
        return
      }
      const revertId = this._fromRevertPointId
      this._fromRevertPointId = ''
      if (revertId) {
        const point = points.find((item) => item.pointId === revertId)
        if (point) {
          const fromIndex = points.findIndex((item) => item.pointId === point.pointId)
          this.setData({
            fromIndex,
            fromQuery: point.name,
            fromDropdownOpen: false,
            hasSelectedFrom: true,
            'form.fromPointId': point.pointId
          }, () => this.refreshRoutePreview())
          return
        }
      }
      this.setData({
        fromQuery: '',
        fromDropdownOpen: false,
        hasSelectedFrom: false,
        fromIndex: -1,
        'form.fromPointId': ''
      }, () => this.refreshRoutePreview())
    })
  },

  onToBlur() {
    poiPickerTouch.runAfterBlur(() => {
      if (poiPickerTouch.shouldDeferPoiBlur(this)) {
        if (this._poiPickerTapLock) this._poiPickerTapLock = false
        return
      }
      const { hasSelectedTo, form, points } = this.data
      if (hasSelectedTo && form.toPointId) {
        this.setData({
          toQuery: getPointDisplayName(points, form.toPointId),
          toDropdownOpen: false,
          publishFloatField: '',
          publishFloatItems: []
        })
        return
      }
      const revertId = this._toRevertPointId
      this._toRevertPointId = ''
      if (revertId) {
        const point = points.find((item) => item.pointId === revertId)
        if (point) {
          const toIndex = points.findIndex((item) => item.pointId === point.pointId)
          this.setData({
            toIndex,
            toQuery: point.name,
            toDropdownOpen: false,
            hasSelectedTo: true,
            'form.toPointId': point.pointId
          }, () => this.refreshRoutePreview())
          return
        }
      }
      this.setData({
        toQuery: '',
        toDropdownOpen: false,
        hasSelectedTo: false,
        toIndex: -1,
        'form.toPointId': ''
      }, () => this.refreshRoutePreview())
    })
  },

  noop() {},

  onFromQueryInput(e) {
    const query = e.detail.value
    const suggestions = filterPoints(this.data.points, query)
    this.setData({
      fromQuery: query,
      fromSuggestions: suggestions,
      toDropdownOpen: false,
      hasSelectedFrom: false,
      fromIndex: -1,
      'form.fromPointId': ''
    }, () => {
      this.refreshRoutePreview()
      if (this.data.fromDropdownOpen) {
        this.setData({ publishFloatItems: this.buildPublishFloatItems('from') })
      } else {
        this.openPublishFloatMenu('from')
      }
    })
  },

  onToQueryInput(e) {
    const query = e.detail.value
    const suggestions = filterPoints(this.data.points, query)
    this.setData({
      toQuery: query,
      toSuggestions: suggestions,
      fromDropdownOpen: false,
      hasSelectedTo: false,
      toIndex: -1,
      'form.toPointId': ''
    }, () => {
      this.refreshRoutePreview()
      if (this.data.toDropdownOpen) {
        this.setData({ publishFloatItems: this.buildPublishFloatItems('to') })
      } else {
        this.openPublishFloatMenu('to')
      }
    })
  },

  onSelectFrom(e) {
    const pointId = e.currentTarget.dataset.id
    const point = this.data.points.find((item) => item.pointId === pointId)
    this.selectFromPoint(point)
  },

  onSelectTo(e) {
    const pointId = e.currentTarget.dataset.id
    const point = this.data.points.find((item) => item.pointId === pointId)
    this.selectToPoint(point)
  },

  closeAllDropdowns() {
    this.setData({
      dateDropdownOpen: false,
      timeDropdownOpen: false,
      countDropdownOpen: false,
      fromDropdownOpen: false,
      toDropdownOpen: false,
      publishFloatField: '',
      publishFloatItems: []
    })
    poiPickerTouch.scheduleFloatMenuTouchEnd(this, 0)
  },

  onPublishFloatTouchStart() {
    poiPickerTouch.markFloatMenuTouch(this)
  },

  onPublishFloatTouchEnd() {
    poiPickerTouch.scheduleFloatMenuTouchEnd(this)
  },

  onPublishFloatScroll() {
    poiPickerTouch.markFloatMenuTouch(this)
  },

  buildPublishFloatItems(field) {
    if (field === 'date') {
      return this.data.dateLabels.map((label, index) => ({
        key: `date-${index}`,
        label,
        index
      }))
    }
    if (field === 'time') {
      return this.data.timeLabels.map((label, index) => ({
        key: `time-${index}`,
        label,
        index
      }))
    }
    if (field === 'from') {
      return this.data.fromSuggestions.map((item) => ({
        key: item.pointId,
        label: item.name,
        pointId: item.pointId
      }))
    }
    if (field === 'to') {
      return this.data.toSuggestions.map((item) => ({
        key: item.pointId,
        label: item.name,
        pointId: item.pointId
      }))
    }
    if (field === 'count') {
      return this.data.countRange.map((count, index) => ({
        key: `count-${count}`,
        label: `${count}人`,
        index
      }))
    }
    return []
  },

  async openPublishFloatMenu(field) {
    const selector = `#publish-field-${field}`
    const items = this.buildPublishFloatItems(field)
    const rect = await measureAnchorRect(this, selector)
    if (!rect) return

    const layout = layoutMenuBelowField(rect)
    if (typeof wx.stopPullDownRefresh === 'function') {
      wx.stopPullDownRefresh()
    }
    this.setData({
      publishFloatField: field,
      publishFloatItems: items,
      publishFloatTop: layout.top,
      publishFloatLeft: layout.left,
      publishFloatWidth: layout.width,
      dateDropdownOpen: field === 'date',
      timeDropdownOpen: field === 'time',
      fromDropdownOpen: field === 'from',
      toDropdownOpen: field === 'to',
      countDropdownOpen: field === 'count'
    })
  },

  onPublishFloatPick(e) {
    poiPickerTouch.lockPickerTap(this)
    const { index, id } = e.currentTarget.dataset
    const field = this.data.publishFloatField
    if (field === 'date') {
      this.onPickDate({ currentTarget: { dataset: { index: Number(index) } } })
      return
    }
    if (field === 'time') {
      this.onPickTime({ currentTarget: { dataset: { index: Number(index) } } })
      return
    }
    if (field === 'from') {
      this.onSelectFrom({ currentTarget: { dataset: { id } } })
      return
    }
    if (field === 'to') {
      this.onSelectTo({ currentTarget: { dataset: { id } } })
      return
    }
    if (field === 'count') {
      this.onPickCount({ currentTarget: { dataset: { index: Number(index) } } })
    }
  },

  onDateFieldTap() {
    if (this.data.dateDropdownOpen) {
      this.closeAllDropdowns()
      return
    }
    this.openPublishFloatMenu('date')
  },

  onTimeFieldTap() {
    if (!this.data.hasAvailableSlots) return
    if (this.data.timeDropdownOpen) {
      this.closeAllDropdowns()
      return
    }
    this.openPublishFloatMenu('time')
  },

  onCountFieldTap() {
    if (this.data.countDropdownOpen) {
      this.closeAllDropdowns()
      return
    }
    this.openPublishFloatMenu('count')
  },

  onPickDate(e) {
    poiPickerTouch.lockPickerTap(this)
    const dateIndex = Number(e.currentTarget.dataset.index)
    const date = this.data.dateValues[dateIndex]
    const slotState = buildSlotViewState(date, new Date())
    this.setData({
      dateIndex,
      dateDropdownOpen: false,
      publishFloatField: '',
      publishFloatItems: [],
      ...slotState,
      'form.date': date,
      'form.timeWindow': slotState.formTimeWindow
    })
  },

  onPickTime(e) {
    poiPickerTouch.lockPickerTap(this)
    const timeIndex = Number(e.currentTarget.dataset.index)
    const selectedSlot = this.data.timeSlots[timeIndex] || null
    this.setData({
      timeIndex,
      timeDropdownOpen: false,
      publishFloatField: '',
      publishFloatItems: [],
      selectedSlot,
      'form.timeWindow': selectedSlot ? selectedSlot.label : ''
    })
  },

  onPickCount(e) {
    poiPickerTouch.lockPickerTap(this)
    const countIndex = Number(e.currentTarget.dataset.index)
    const count = this.data.countRange[countIndex]
    if (!count) return
    this.setData({
      countIndex,
      countDropdownOpen: false,
      publishFloatField: '',
      publishFloatItems: [],
      'form.passengerCount': count
    })
  },

  toggleNoteTag(e) {
    const tag = e.currentTarget.dataset.tag
    const selectedNoteMap = {
      ...this.data.selectedNoteMap,
      [tag]: !this.data.selectedNoteMap[tag]
    }
    if (!selectedNoteMap[tag]) delete selectedNoteMap[tag]
    this.setData({ selectedNoteMap })
  },

  onNoteInput(e) {
    const note = e.detail.value
    this.setData({
      'form.note': note,
      noteLength: note.length
    })
  },

  goAddPassengerIdentity() {
    wx.showModal({
      title: '添加乘车人身份',
      content: '添加后可在「我的」中切换乘车人模式，是否继续？',
      confirmText: '添加',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await app.addIdentity('passenger')
          wx.navigateTo({ url: '/pages/preference/preference?setup=1' })
        } catch (error) {
          wx.showToast({ title: '添加身份失败，请重试', icon: 'none' })
        }
      }
    })
  },

  goPreference() {
    this._returningFromPreference = true
    wx.navigateTo({ url: '/pages/preference/preference' })
  },

  async onSubmit() {
    if (this.data.submitting) return

    const { form, selectedSlot, selectedNoteMap } = this.data
    const submitNote = buildSubmitNote(selectedNoteMap, form.note)

    if (!form.date) {
      wx.showToast({ title: '请选择出发日期', icon: 'none' })
      return
    }
    if (!selectedSlot) {
      wx.showToast({ title: '请选择出发时间窗', icon: 'none' })
      return
    }
    if (!form.fromPointId || !this.data.hasSelectedFrom) {
      wx.showToast({ title: '请选择出发地点', icon: 'none' })
      return
    }
    if (!form.toPointId || !this.data.hasSelectedTo) {
      wx.showToast({ title: '请选择目的地', icon: 'none' })
      return
    }
    if (!form.passengerCount) {
      wx.showToast({ title: '请选择出行人数', icon: 'none' })
      return
    }

    this.setData({ submitting: true })

    try {
      const openId = await auth.ensureLogin()
      const profile = await auth.getProfile()
      const storedTime = formatDepartTimeForStorage(form.date, selectedSlot)
      const payload = {
        fromPointId: form.fromPointId,
        toPointId: form.toPointId,
        departTime: storedTime.departTime,
        departTimeEnd: storedTime.departTimeEnd,
        passengerCount: form.passengerCount,
        note: submitNote,
        passengerOpenId: openId,
        passengerName: (profile && profile.nickName) || app.globalData.userInfo.displayName || '乘客'
      }

      let targetId = this.data.editingOrderId
      if (this.data.editMode && targetId) {
        const updated = await order.updateOrder(targetId, payload)
        targetId = updated._id || targetId
        wx.showToast({ title: '保存成功', icon: 'success' })
      } else {
        const created = await order.createOrder(payload)
        targetId = created._id
        wx.showToast({ title: '发布成功', icon: 'success' })
      }

      app._syncAuth()

      setTimeout(() => {
        wx.navigateTo({ url: `/pages/detail/detail?orderId=${targetId}&role=passenger` })
      }, 400)
    } catch (error) {
      const messageMap = {
        INVALID_POI: '请选择有效的上下车地点',
        INVALID_DEPART_TIME: '请选择有效的 15 分钟时间窗',
        OVERLAPPING_ORDER: '该时段已有进行中的订单',
        INVALID_PASSENGER_COUNT: '出行人数无效',
        INVALID_NOTE: `备注不超过 ${MAX_NOTE_LENGTH} 字`,
        NOT_LOGGED_IN: '请先登录',
        INVALID_ACTION: '请重新部署 order 云函数后再保存'
      }
      wx.showToast({
        title: messageMap[error.code] || error.message || '发布失败',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
