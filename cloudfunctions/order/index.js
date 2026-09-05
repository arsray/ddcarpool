// SECURITY-REVIEW: 所有订单操作都以微信上下文 OPENID 授权，绝不信任客户端提交的身份字段。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
const orders = db.collection('orders')
const points = db.collection('points')
const routes = db.collection('configured_routes')
const notifications = db.collection('notifications')
const ACTIVE_STATUSES = ['matching', 'pending_departure', 'in_progress']
const CHAT_STATUSES = ['pending_departure', 'in_progress']
const VALID_ROLES = new Set(['passenger', 'driver'])
const PAGE_SIZE = 50

function ok(data) {
  return { ok: true, data }
}

function fail(code, message) {
  return { ok: false, code, message }
}

function appError(code, message) {
  return Object.assign(new Error(code), { code, publicMessage: message })
}

function cleanString(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength)
}

function parseShanghaiTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(cleanString(value, 16))
  if (!match) return null
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:00+08:00`
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function parseWindowEnd(departTime, endClock) {
  const datePart = cleanString(departTime, 16).slice(0, 10)
  const clock = cleanString(endClock, 5)
  if (!/^\d{2}:\d{2}$/.test(clock) && clock !== '24:00') return null
  if (clock === '24:00') {
    const start = parseShanghaiTime(departTime)
    if (!start) return null
    return new Date(start.getTime() + 15 * 60 * 1000)
  }
  return parseShanghaiTime(`${datePart} ${clock}`)
}

function publicOrder(doc, viewerOpenId) {
  if (!doc) return null
  const { _openid, passengerOpenId, driverOpenId, ...safe } = doc
  const viewerRole = passengerOpenId === viewerOpenId
    ? 'passenger'
    : driverOpenId === viewerOpenId
      ? 'driver'
      : ''
  return { ...safe, viewerRole }
}

async function attachDriverDisplayFields(doc, viewerOpenId) {
  if (!doc || doc.passengerOpenId !== viewerOpenId || !doc.driverOpenId) return doc
  if (!['pending_departure', 'in_progress', 'completed'].includes(doc.status)) return doc

  let driverName = doc.driverName
  let driverVehicle = doc.driverVehicle
  if (driverName && driverVehicle) return doc

  const profile = await currentProfile(doc.driverOpenId)
  if (!driverName) driverName = profile.name || '司机'
  if (!driverVehicle) driverVehicle = snapshotDriverVehicle(profile.vehicle)

  return {
    ...doc,
    driverName,
    ...(driverVehicle ? { driverVehicle } : {})
  }
}

function isParticipant(order, openId) {
  return order.passengerOpenId === openId || order.driverOpenId === openId
}

async function currentProfile(openId) {
  const response = await db.collection('users').where({ openId }).limit(1).get()
  const user = response.data[0]
  return user
    ? {
        name: cleanString(user.displayName || user.nickName, 40),
        identities: user.identities || [],
        vehicle: user.vehicle || null
      }
    : { name: '', identities: [], vehicle: null }
}

function snapshotDriverVehicle(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') return null
  const plate =
    cleanString(vehicle.plate, 20) ||
    `${cleanString(vehicle.platePrefix, 2)}${cleanString(vehicle.plateSuffix, 10)}`.trim()
  const brand = cleanString(vehicle.brand, 40)
  const color = cleanString(vehicle.color, 20)
  if (!brand && !plate && !color) return null
  return { brand, plate, color }
}

async function validatePoints(fromPointId, toPointId) {
  if (!fromPointId || !toPointId || fromPointId === toPointId) {
    throw appError('INVALID_POI', '请选择有效且不同的上下车地点')
  }
  const response = await points.where({
    pointId: _.in([fromPointId, toPointId]),
    enabled: _.neq(false)
  }).get()
  const found = new Set(response.data.map((item) => item.pointId))
  if (!found.has(fromPointId) || !found.has(toPointId)) {
    throw appError('INVALID_POI', '请选择有效的上下车地点')
  }
}

function validateCreateInput(event) {
  const fromPointId = cleanString(event.fromPointId, 50)
  const toPointId = cleanString(event.toPointId, 50)
  const departTime = cleanString(event.departTime, 16)
  const departTimeEnd = cleanString(event.departTimeEnd, 5)
  const passengerCount = Number(event.passengerCount)
  const note = cleanString(event.note, 101)
  const departTimeAt = parseShanghaiTime(departTime)
  const departTimeEndAt = parseWindowEnd(departTime, departTimeEnd)

  if (!departTimeAt || !departTimeEndAt || departTimeEndAt <= new Date()) {
    throw appError('INVALID_DEPART_TIME', '请选择有效的未来出发时间')
  }
  if (departTimeEndAt.getTime() - departTimeAt.getTime() !== 15 * 60 * 1000) {
    throw appError('INVALID_DEPART_TIME', '请选择 15 分钟出发时间窗')
  }
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 10) {
    throw appError('INVALID_PASSENGER_COUNT', '出行人数需在 1–10 人')
  }
  if (note.length > 100) throw appError('INVALID_NOTE', '备注不超过 100 字')

  return {
    fromPointId,
    toPointId,
    departTime,
    departTimeEnd,
    departTimeAt,
    departTimeEndAt,
    passengerCount,
    note
  }
}

async function createOrder(event, openId) {
  const input = validateCreateInput(event)
  await validatePoints(input.fromPointId, input.toPointId)
  const profile = await currentProfile(openId)
  if (!profile.identities.includes('passenger')) {
    throw appError('FORBIDDEN', '请先开通乘车人身份')
  }

  return db.runTransaction(async (transaction) => {
    const overlapping = await transaction.collection('orders').where({
      passengerOpenId: openId,
      status: _.in(ACTIVE_STATUSES)
    }).limit(100).get()
    const hasOverlap = overlapping.data.some((item) => (
      new Date(item.departTimeAt).getTime() < input.departTimeEndAt.getTime() &&
      new Date(item.departTimeEndAt).getTime() > input.departTimeAt.getTime()
    ))
    if (hasOverlap) {
      throw appError('OVERLAPPING_ORDER', '该时段已有进行中的订单')
    }

    const now = db.serverDate()
    const response = await transaction.collection('orders').add({
      data: {
        ...input,
        status: 'matching',
        passengerOpenId: openId,
        passengerName: profile.name || '乘客',
        driverOpenId: '',
        driverName: '',
        createdAt: now,
        updatedAt: now
      }
    })
    return publicOrder(
      await transaction.collection('orders').doc(response._id).get().then((r) => r.data),
      openId
    )
  })
}

async function listOpen(openId) {
  await expireStale()
  const response = await orders.where({ status: 'matching' })
    .orderBy('departTimeAt', 'asc')
    .limit(100)
    .get()
  const now = Date.now()
  return response.data
    .filter((item) => (
      item.passengerOpenId !== openId &&
      new Date(item.departTimeEndAt).getTime() > now
    ))
    .slice(0, PAGE_SIZE)
    .map((item) => publicOrder(item, openId))
}

async function listDriverActive(openId) {
  const response = await orders.where({
    driverOpenId: openId,
    status: _.in(['pending_departure', 'in_progress'])
  }).orderBy('departTimeAt', 'asc').limit(PAGE_SIZE).get()
  return response.data.map((item) => publicOrder(item, openId))
}

async function listForUser(openId, role) {
  if (!VALID_ROLES.has(role)) throw appError('INVALID_ROLE', '订单角色无效')
  const query = role === 'passenger'
    ? { passengerOpenId: openId }
    : { driverOpenId: openId }
  const response = await orders.where(query).orderBy('createdAt', 'desc').limit(PAGE_SIZE).get()
  const docs = role === 'passenger'
    ? await Promise.all(response.data.map((item) => attachDriverDisplayFields(item, openId)))
    : response.data
  return docs.map((item) => publicOrder(item, openId))
}

async function getById(orderId, openId) {
  const id = cleanString(orderId, 64)
  const response = await orders.where({ _id: id }).limit(1).get()
  const order = response.data[0]
  if (!order) throw appError('ORDER_NOT_FOUND', '订单不存在')
  if (order.status !== 'matching' && !isParticipant(order, openId)) {
    throw appError('FORBIDDEN', '无权查看此订单')
  }
  const enriched = await attachDriverDisplayFields(order, openId)
  return publicOrder(enriched, openId)
}

function notificationData(recipientOpenId, title, targetId, targetType) {
  return {
    recipientOpenId,
    title: cleanString(title, 120),
    targetId,
    targetType,
    read: false,
    createdAt: db.serverDate()
  }
}

async function acceptOrder(event, openId) {
  const orderId = cleanString(event.orderId, 64)
  const profile = await currentProfile(openId)
  if (!profile.identities.includes('owner')) {
    throw appError('FORBIDDEN', '请先开通车主身份')
  }

  return db.runTransaction(async (transaction) => {
    const response = await transaction.collection('orders').where({ _id: orderId }).limit(1).get()
    const order = response.data[0]
    if (!order) throw appError('ORDER_NOT_FOUND', '订单不存在')
    if (order.passengerOpenId === openId) throw appError('SELF_ACCEPT', '不能接自己的单')
    if (order.status !== 'matching' || order.driverOpenId) {
      throw appError('ALREADY_ACCEPTED', '订单已被接取')
    }
    if (order.departTimeEndAt && new Date(order.departTimeEndAt).getTime() <= Date.now()) {
      throw appError('INVALID_STATUS', '订单已过期')
    }

    const now = db.serverDate()
    const driverVehicle = snapshotDriverVehicle(profile.vehicle)
    const updateData = {
      status: 'pending_departure',
      driverOpenId: openId,
      driverName: profile.name || '司机',
      matchedAt: now,
      updatedAt: now
    }
    if (driverVehicle) updateData.driverVehicle = driverVehicle

    await transaction.collection('orders').doc(orderId).update({
      data: updateData
    })
    await transaction.collection('notifications').add({
      data: notificationData(
        order.passengerOpenId,
        `${profile.name || '司机'} 已接取您的订单`,
        orderId,
        'passenger'
      )
    })
    return publicOrder((await transaction.collection('orders').doc(orderId).get()).data, openId)
  })
}

async function cancelOrder(event, openId) {
  const orderId = cleanString(event.orderId, 64)
  return db.runTransaction(async (transaction) => {
    const response = await transaction.collection('orders').where({ _id: orderId }).limit(1).get()
    const order = response.data[0]
    if (!order) throw appError('ORDER_NOT_FOUND', '订单不存在')
    if (order.status === 'in_progress') {
      throw appError('TRIP_IN_PROGRESS_NO_CANCEL', '行程中不可取消')
    }
    const now = db.serverDate()

    if (
      order.passengerOpenId === openId &&
      ['matching', 'pending_departure'].includes(order.status)
    ) {
      await transaction.collection('orders').doc(orderId).update({
        data: {
          status: 'closed',
          closeReason: 'cancelled_by_passenger',
          closedAt: now,
          updatedAt: now
        }
      })
      if (order.driverOpenId) {
        await transaction.collection('notifications').add({
          data: notificationData(order.driverOpenId, '乘客已取消搭车单', orderId, 'owner')
        })
      }
    } else if (order.driverOpenId === openId && order.status === 'pending_departure') {
      await transaction.collection('orders').doc(orderId).update({
        data: {
          status: 'matching',
          driverOpenId: '',
          driverName: '',
          driverVehicle: _.remove(),
          matchedAt: _.remove(),
          updatedAt: now
        }
      })
      await transaction.collection('notifications').add({
        data: notificationData(
          order.passengerOpenId,
          '司机已取消匹配，订单已重新开放',
          orderId,
          'passenger'
        )
      })
    } else {
      throw appError('FORBIDDEN', '无权取消此订单')
    }
    return publicOrder((await transaction.collection('orders').doc(orderId).get()).data, openId)
  })
}

async function transition(event, openId, target) {
  const orderId = cleanString(event.orderId, 64)
  return db.runTransaction(async (transaction) => {
    const response = await transaction.collection('orders').where({ _id: orderId }).limit(1).get()
    const order = response.data[0]
    if (!order) throw appError('ORDER_NOT_FOUND', '订单不存在')
    if (!isParticipant(order, openId)) throw appError('FORBIDDEN', '无权操作此订单')

    const allowed = target === 'in_progress'
      ? order.status === 'pending_departure' && order.driverOpenId === openId
      : ['pending_departure', 'in_progress'].includes(order.status)
    if (!allowed) throw appError('INVALID_STATUS', '订单当前状态不允许该操作')

    const now = db.serverDate()
    const timestampField = target === 'in_progress' ? 'startedAt' : 'completedAt'
    await transaction.collection('orders').doc(orderId).update({
      data: { status: target, [timestampField]: now, updatedAt: now }
    })
    return publicOrder((await transaction.collection('orders').doc(orderId).get()).data, openId)
  })
}

async function expireStale() {
  const response = await orders.where({
    status: 'matching',
    departTimeEndAt: _.lte(new Date())
  }).update({
    data: {
      status: 'closed',
      closeReason: 'expired',
      closedAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })
  return { updated: response.stats ? response.stats.updated : 0 }
}

async function listPoints() {
  const response = await points.where({ enabled: _.neq(false) }).orderBy('sortOrder', 'asc').limit(100).get()
  return response.data.map(({ _openid, ...item }) => item)
}

async function listRoutes() {
  const response = await routes.where({ enabled: _.neq(false) }).limit(100).get()
  return response.data.map(({ _openid, ...item }) => item)
}

exports.main = async (event) => {
  try {
    if (event && event.Type === 'Timer') return ok(await expireStale())
    const { OPENID } = cloud.getWXContext()
    if (!OPENID) return fail('NOT_AUTHENTICATED', '请先登录')
    const action = event && event.action

    if (action === 'create') return ok(await createOrder(event, OPENID))
    if (action === 'listOpen') return ok(await listOpen(OPENID))
    if (action === 'listDriverActive') return ok(await listDriverActive(OPENID))
    if (action === 'listForUser') return ok(await listForUser(OPENID, event.role))
    if (action === 'getById') return ok(await getById(event.orderId, OPENID))
    if (action === 'accept') return ok(await acceptOrder(event, OPENID))
    if (action === 'cancel') return ok(await cancelOrder(event, OPENID))
    if (action === 'start') return ok(await transition(event, OPENID, 'in_progress'))
    if (action === 'complete') return ok(await transition(event, OPENID, 'completed'))
    if (action === 'expireStale') return ok(await expireStale())
    if (action === 'listPoints') return ok(await listPoints())
    if (action === 'listRoutes') return ok(await listRoutes())
    return fail('INVALID_ACTION', '不支持的订单操作')
  } catch (error) {
    const code = error && error.code
    if (code && code !== 'DATABASE_REQUEST_FAILED') {
      return fail(code, error.publicMessage || '订单操作失败')
    }
    console.error('[order] failed', { name: error && error.name })
    return fail('ORDER_SERVICE_FAILED', '订单服务暂时不可用')
  }
}

exports.expireStale = async () => {
  try {
    return ok(await expireStale())
  } catch (error) {
    console.error('[order.expireStale] failed', { name: error && error.name })
    return fail('ORDER_SERVICE_FAILED', '订单过期任务执行失败')
  }
}
