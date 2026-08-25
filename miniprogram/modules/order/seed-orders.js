/**
 * 广场 Mock 乘客订单 — 司机接单流程测试用
 * 每次启动按相对日期重建 seed_* 订单，保留用户自行发布的订单
 */

const { ORDER_STATUS } = require('./constants/status')
const {
  buildAvailableSlotsForDate,
  formatDepartTimeForStorage
} = require('./time-slots')
const { normalizeEmail } = require('../auth/email')

const SEED_ID_PREFIX = 'seed_'

const MOCK_PASSENGERS = [
  { email: 'carol.passenger@disney.com', name: 'Carol' },
  { email: 'david.passenger@disney.com', name: 'David' },
  { email: 'emma.passenger@disney.com', name: 'Emma' },
  { email: 'frank.passenger@disney.com', name: 'Frank' },
  { email: 'grace.passenger@disney.com', name: 'Grace' },
  { email: 'henry.passenger@disney.com', name: 'Henry' },
  { email: 'iris.passenger@disney.com', name: 'Iris' },
  { email: 'alice.passenger@disney.com', name: 'Alice' }
]

/** dayOffset: 0=今天；slotOffset: 当日可选时间窗中的第 N 个（跨天顺延） */
const ORDER_TEMPLATES = [
  {
    id: `${SEED_ID_PREFIX}01`,
    passengerIndex: 0,
    fromPointId: 'poi-06',
    toPointId: 'poi-08',
    dayOffset: 0,
    slotOffset: 0,
    passengerCount: 1,
    note: '赶早会，希望准时'
  },
  {
    id: `${SEED_ID_PREFIX}02`,
    passengerIndex: 1,
    fromPointId: 'poi-02',
    toPointId: 'poi-10',
    dayOffset: 0,
    slotOffset: 1,
    passengerCount: 2,
    note: '携带大件行李'
  },
  {
    id: `${SEED_ID_PREFIX}03`,
    passengerIndex: 2,
    fromPointId: 'poi-03',
    toPointId: 'poi-14',
    dayOffset: 0,
    slotOffset: 2,
    passengerCount: 1,
    note: ''
  },
  {
    id: `${SEED_ID_PREFIX}04`,
    passengerIndex: 3,
    fromPointId: 'poi-05',
    toPointId: 'poi-02',
    dayOffset: 0,
    slotOffset: 3,
    passengerCount: 1,
    note: '下班顺路即可'
  },
  {
    id: `${SEED_ID_PREFIX}05`,
    passengerIndex: 4,
    fromPointId: 'poi-08',
    toPointId: 'poi-06',
    dayOffset: 0,
    slotOffset: 4,
    passengerCount: 3,
    note: '三人同行'
  },
  {
    id: `${SEED_ID_PREFIX}06`,
    passengerIndex: 5,
    fromPointId: 'poi-01',
    toPointId: 'poi-11',
    dayOffset: 1,
    slotOffset: 0,
    passengerCount: 1,
    note: '明日早班'
  },
  {
    id: `${SEED_ID_PREFIX}07`,
    passengerIndex: 6,
    fromPointId: 'poi-07',
    toPointId: 'poi-12',
    dayOffset: 1,
    slotOffset: 2,
    passengerCount: 1,
    note: ''
  },
  {
    id: `${SEED_ID_PREFIX}08`,
    passengerIndex: 7,
    fromPointId: 'poi-06',
    toPointId: 'poi-03',
    dayOffset: 1,
    slotOffset: 4,
    passengerCount: 2,
    note: '可稍等 5 分钟'
  },
  {
    id: `${SEED_ID_PREFIX}09`,
    passengerIndex: 0,
    fromPointId: 'poi-10',
    toPointId: 'poi-15',
    dayOffset: 2,
    slotOffset: 1,
    passengerCount: 1,
    note: '去羽托邦办事'
  },
  {
    id: `${SEED_ID_PREFIX}10`,
    passengerIndex: 1,
    fromPointId: 'poi-04',
    toPointId: 'poi-08',
    dayOffset: 2,
    slotOffset: 3,
    passengerCount: 1,
    note: ''
  }
]

function mockOpenId(email) {
  const normalized = normalizeEmail(email)
  return normalized ? `mock_${normalized.replace(/[^a-z0-9]/g, '_')}` : ''
}

function formatDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(base, offset) {
  const next = new Date(base)
  next.setDate(next.getDate() + offset)
  return next
}

function findSchedule(dayOffset, slotOffset, now) {
  let remaining = Math.max(0, slotOffset)
  for (let offset = dayOffset; offset <= dayOffset + 7; offset += 1) {
    const dateStr = formatDateStr(addDays(now, offset))
    const slots = buildAvailableSlotsForDate(dateStr, now)
    if (slots.length > remaining) {
      return { dateStr, slot: slots[remaining] }
    }
    remaining -= slots.length
  }
  return null
}

function buildSeedOrder(template, now) {
  const passenger = MOCK_PASSENGERS[template.passengerIndex]
  if (!passenger) return null

  const resolved = findSchedule(template.dayOffset, template.slotOffset, now)
  if (!resolved) return null

  const { dateStr, slot } = resolved
  const { departTime, departTimeEnd } = formatDepartTimeForStorage(dateStr, slot)
  const timestamp = now.toISOString()

  return {
    _id: template.id,
    fromPointId: template.fromPointId,
    toPointId: template.toPointId,
    departTime,
    departTimeEnd,
    passengerCount: template.passengerCount,
    note: template.note || '',
    status: ORDER_STATUS.MATCHING,
    passengerOpenId: mockOpenId(passenger.email),
    passengerName: passenger.name,
    driverOpenId: '',
    driverName: '',
    createdAt: timestamp,
    updatedAt: timestamp
  }
}

function buildPlazaSeedOrders(now) {
  return ORDER_TEMPLATES.map((template) => buildSeedOrder(template, now)).filter(Boolean)
}

function refreshPlazaSeedOrders(now) {
  const service = require('./service')
  const seedOrders = buildPlazaSeedOrders(now || new Date())
  service.replacePlazaSeedOrders(seedOrders)
  return seedOrders.length
}

module.exports = {
  SEED_ID_PREFIX,
  buildPlazaSeedOrders,
  refreshPlazaSeedOrders
}
