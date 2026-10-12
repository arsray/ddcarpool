/**
 * 「再来一单」— Tab 跳转无法带 query，用一次性草稿预填发布页
 * 预填：起终点、人数、备注；日期/时间窗仍走发布页默认逻辑
 */

const { PREFERENCE_NOTE_TAGS } = require('../auth/vehicle-data')

let pendingDraft = null
let pendingEditDraft = null

function buildRepublishDraft(orderItem, m3Order) {
  const item = orderItem || {}
  const m3 = m3Order || {}
  return {
    fromPointId: m3.fromPointId || item.fromPointId || '',
    toPointId: m3.toPointId || item.toPointId || '',
    fromName: item.from || '',
    toName: item.to || '',
    passengerCount: item.count || m3.passengerCount || 1,
    note: (item.note || m3.note || '').trim()
  }
}

function setRepublishDraft(draft) {
  pendingDraft = draft && typeof draft === 'object' ? { ...draft } : null
}

function consumeRepublishDraft() {
  const draft = pendingDraft
  pendingDraft = null
  return draft
}

function buildEditDraftFromOrder(orderItem) {
  const item = orderItem || {}
  const departTime = (item.departTime || '').trim()
  const date = departTime.length >= 10 ? departTime.slice(0, 10) : ''
  const start = departTime.length >= 16 ? departTime.slice(11, 16) : ''
  const end = (item.departTimeEnd || '').trim()
  const timeWindow = start && end ? `${start}-${end}` : ''
  return {
    orderId: item._id || '',
    fromPointId: item.fromPointId || '',
    toPointId: item.toPointId || '',
    passengerCount: item.passengerCount || 1,
    note: (item.note || '').trim(),
    date,
    timeWindow
  }
}

function setEditOrderDraft(draft) {
  pendingEditDraft = draft && typeof draft === 'object' ? { ...draft } : null
}

function consumeEditOrderDraft() {
  const draft = pendingEditDraft
  pendingEditDraft = null
  return draft
}

function parseNoteForRepublish(note, noteTags) {
  const tags = noteTags || PREFERENCE_NOTE_TAGS
  const raw = (note || '').trim()
  if (!raw) {
    return { selectedNoteMap: {}, supplementNote: '' }
  }

  const parts = raw.split(' · ').map((part) => part.trim()).filter(Boolean)
  const selectedNoteMap = {}
  const supplementParts = []

  parts.forEach((part) => {
    if (tags.includes(part)) {
      selectedNoteMap[part] = true
    } else {
      supplementParts.push(part)
    }
  })

  if (!Object.keys(selectedNoteMap).length && !supplementParts.length && raw) {
    supplementParts.push(raw)
  }

  return {
    selectedNoteMap,
    supplementNote: supplementParts.join(' · ')
  }
}

function findPointIndex(points, { pointId, name }) {
  const list = points || []
  if (pointId) {
    const byId = list.findIndex((point) => point.pointId === pointId)
    if (byId >= 0) return byId
  }
  const label = (name || '').trim()
  if (!label) return -1

  let idx = list.findIndex((point) => point.name === label)
  if (idx >= 0) return idx

  idx = list.findIndex((point) => point.name.includes(label) || label.includes(point.name))
  return idx
}

/**
 * @returns {{ fromIndex, toIndex, hasSelectedFrom, hasSelectedTo, fromPointId, toPointId, countIndex, selectedNoteMap, supplementNote }}
 */
function applyRepublishDraft(draft, points, countRange) {
  if (!draft) return null

  const range = countRange || []
  const maxCount = range.length ? range[range.length - 1] : 10
  const passengerCount = Math.min(maxCount, Math.max(1, Number(draft.passengerCount) || 1))
  const countIndex = Math.max(0, passengerCount - 1)
  const fromIndex = findPointIndex(points, {
    pointId: draft.fromPointId,
    name: draft.fromName
  })
  const toIndex = findPointIndex(points, {
    pointId: draft.toPointId,
    name: draft.toName
  })
  const noteParts = parseNoteForRepublish(draft.note)

  return {
    fromIndex,
    toIndex,
    hasSelectedFrom: fromIndex >= 0,
    hasSelectedTo: toIndex >= 0,
    fromPointId: fromIndex >= 0 ? points[fromIndex].pointId : '',
    toPointId: toIndex >= 0 ? points[toIndex].pointId : '',
    countIndex,
    passengerCount,
    selectedNoteMap: noteParts.selectedNoteMap,
    supplementNote: noteParts.supplementNote
  }
}

/**
 * @param {{ buildSlotViewState: Function }} helpers
 */
function applyEditOrderDraft(draft, points, countRange, dateValues, helpers) {
  if (!draft || !draft.orderId) return null
  const republish = applyRepublishDraft(draft, points, countRange)
  if (!republish) return null

  const noteParts = parseNoteForRepublish(draft.note)
  const now = new Date()
  let dateIndex = dateValues.indexOf(draft.date)
  if (dateIndex < 0) dateIndex = 0
  const date = dateValues[dateIndex] || draft.date || dateValues[0]
  const slotState = helpers.buildSlotViewState(date, now)
  let timeIndex = 0
  let selectedSlot = slotState.timeSlots[0] || null
  if (draft.timeWindow && slotState.timeSlots.length) {
    const idx = slotState.timeSlots.findIndex((slot) => slot.label === draft.timeWindow)
    if (idx >= 0) {
      timeIndex = idx
      selectedSlot = slotState.timeSlots[idx]
    }
  }

  return {
    ...republish,
    orderId: draft.orderId,
    dateIndex,
    selectedNoteMap: noteParts.selectedNoteMap,
    supplementNote: noteParts.supplementNote,
    ...slotState,
    timeIndex,
    selectedSlot,
    formDate: date,
    formTimeWindow: selectedSlot ? selectedSlot.label : slotState.formTimeWindow
  }
}

module.exports = {
  buildRepublishDraft,
  buildEditDraftFromOrder,
  setEditOrderDraft,
  setRepublishDraft,
  consumeRepublishDraft,
  consumeEditOrderDraft,
  parseNoteForRepublish,
  findPointIndex,
  applyRepublishDraft,
  applyEditOrderDraft
}
