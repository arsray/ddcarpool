/**
 * 出发时间 15 分钟区间 — 如 15:00-15:15
 */

const SLOT_MINUTES = 15
const DAY_START_MINUTES = 8 * 60
const DAY_END_MINUTES = 22 * 60

function padTimePart(value) {
  return String(value).padStart(2, '0')
}

function formatClock(hours, minutes) {
  return `${padTimePart(hours)}:${padTimePart(minutes)}`
}

function addMinutesToClock(hours, minutes, delta) {
  const total = hours * 60 + minutes + delta
  if (total >= 24 * 60) {
    return '24:00'
  }
  const nextHours = Math.floor(total / 60)
  const nextMinutes = total % 60
  return formatClock(nextHours, nextMinutes)
}

function buildDailyTimeSlots() {
  const slots = []
  let index = 0
  for (
    let startTotal = DAY_START_MINUTES;
    startTotal + SLOT_MINUTES <= DAY_END_MINUTES;
    startTotal += SLOT_MINUTES
  ) {
    const startHours = Math.floor(startTotal / 60)
    const startMinutes = startTotal % 60
    const startTime = formatClock(startHours, startMinutes)
    const endTime = addMinutesToClock(startHours, startMinutes, SLOT_MINUTES)
    slots.push({
      index,
      startTime,
      endTime,
      label: `${startTime}-${endTime}`
    })
    index += 1
  }
  return slots
}

function parseDateOnly(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateStr || '').trim())
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseDepartTime(str) {
  if (!str || typeof str !== 'string') return null
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(str.trim())
  if (!match) return null
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0
  )
  return Number.isNaN(date.getTime()) ? null : date
}

function buildSlotDateTime(dateStr, timeStr) {
  const day = parseDateOnly(dateStr)
  if (!day || !timeStr) return null
  const parts = /^(\d{2}):(\d{2})$/.exec(timeStr)
  if (!parts) return null
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Number(parts[1]),
    Number(parts[2]),
    0,
    0
  )
}

function getSlotEndDateTime(dateStr, startTime, endTime) {
  const start = buildSlotDateTime(dateStr, startTime)
  if (!start) return null
  if (endTime === '24:00') {
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    end.setHours(0, 0, 0, 0)
    return end
  }
  return buildSlotDateTime(dateStr, endTime)
}

function isAlignedSlot(startTime) {
  const slots = buildDailyTimeSlots()
  return slots.some((slot) => slot.startTime === startTime)
}

function getNextSlotStartTotalMinutes(now) {
  const baseNow = now || new Date()
  const total = baseNow.getHours() * 60 + baseNow.getMinutes()
  const remainder = total % SLOT_MINUTES
  return remainder === 0 ? total : total + (SLOT_MINUTES - remainder)
}

function getNextSlotStartClock(now) {
  const aligned = getNextSlotStartTotalMinutes(now)
  if (aligned >= 24 * 60) return null
  return formatClock(Math.floor(aligned / 60), aligned % 60)
}

function buildAvailableSlotsForDate(dateStr, now) {
  const baseNow = now || new Date()
  const allSlots = buildDailyTimeSlots()
  const day = parseDateOnly(dateStr)
  if (!day) return []

  const isToday =
    day.getFullYear() === baseNow.getFullYear() &&
    day.getMonth() === baseNow.getMonth() &&
    day.getDate() === baseNow.getDate()

  if (!isToday) return allSlots

  const nextStartClock = getNextSlotStartClock(baseNow)
  if (!nextStartClock) return []

  return allSlots.filter((slot) => {
    if (slot.startTime < nextStartClock) return false
    const end = getSlotEndDateTime(dateStr, slot.startTime, slot.endTime)
    return end && end.getTime() > baseNow.getTime()
  })
}

function getDefaultSlotIndex(dateStr, now) {
  const available = buildAvailableSlotsForDate(dateStr, now)
  if (!available.length) return 0
  return available[0].index
}

function formatDepartTimeForStorage(dateStr, slot) {
  return {
    departTime: `${dateStr} ${slot.startTime}`,
    departTimeEnd: slot.endTime
  }
}

function getDepartWindowEnd(order) {
  const start = parseDepartTime(order.departTime)
  if (!start) return null

  if (order.departTimeEnd) {
    if (order.departTimeEnd === '24:00') {
      const end = new Date(start)
      end.setDate(end.getDate() + 1)
      end.setHours(0, 0, 0, 0)
      return end
    }
    const dateStr = order.departTime.slice(0, 10)
    return getSlotEndDateTime(dateStr, order.departTime.slice(11, 16), order.departTimeEnd)
  }

  return new Date(start.getTime() + SLOT_MINUTES * 60 * 1000)
}

function formatDepartTimeDisplay(order) {
  if (!order || !order.departTime) return ''
  const start = order.departTime.slice(11, 16)
  if (order.departTimeEnd) {
    return `${order.departTime.slice(0, 10)} ${start}-${order.departTimeEnd}`
  }
  const endDate = getDepartWindowEnd(order)
  if (!endDate) return order.departTime
  const endLabel =
    endDate.getHours() === 0 && endDate.getMinutes() === 0 && endDate.getDate() !== parseDepartTime(order.departTime).getDate()
      ? '24:00'
      : formatClock(endDate.getHours(), endDate.getMinutes())
  return `${order.departTime.slice(0, 10)} ${start}-${endLabel}`
}

function formatHistoryTimeLabel(order) {
  if (!order || !order.departTime) return ''
  const start = order.departTime.slice(11, 16)
  if (order.departTimeEnd) {
    return `${start}-${order.departTimeEnd}`
  }
  const endDate = getDepartWindowEnd(order)
  if (!endDate) return start
  const endLabel =
    endDate.getHours() === 0 && endDate.getMinutes() === 0
      ? '24:00'
      : formatClock(endDate.getHours(), endDate.getMinutes())
  return `${start}-${endLabel}`
}

function windowsOverlap(orderA, orderB) {
  const startA = parseDepartTime(orderA.departTime)
  const startB = parseDepartTime(orderB.departTime)
  const endA = getDepartWindowEnd(orderA)
  const endB = getDepartWindowEnd(orderB)
  if (!startA || !startB || !endA || !endB) return false
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime()
}

function findSlotByIndex(index) {
  return buildDailyTimeSlots().find((slot) => slot.index === index) || null
}

module.exports = {
  SLOT_MINUTES,
  DAY_START_MINUTES,
  DAY_END_MINUTES,
  buildDailyTimeSlots,
  getNextSlotStartClock,
  getNextSlotStartTotalMinutes,
  buildAvailableSlotsForDate,
  getDefaultSlotIndex,
  formatDepartTimeForStorage,
  formatDepartTimeDisplay,
  formatHistoryTimeLabel,
  getDepartWindowEnd,
  windowsOverlap,
  isAlignedSlot,
  parseDepartTime,
  findSlotByIndex
}
