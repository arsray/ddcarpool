/**
 * 接单时快照车主车辆信息，供乘客详情页展示
 */

const config = require('../../config/index')
const { ORDER_STATUS } = require('./constants/status')

const DRIVER_CARD_STATUSES = [
  ORDER_STATUS.PENDING_DEPARTURE,
  ORDER_STATUS.IN_PROGRESS,
  ORDER_STATUS.COMPLETED
]

function snapshotDriverVehicle(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') return null

  const plate =
    String(vehicle.plate || '').trim() ||
    `${String(vehicle.platePrefix || '').trim()}${String(vehicle.plateSuffix || '').trim()}`.trim()

  const brand = String(vehicle.brand || '').trim()
  const color = String(vehicle.color || '').trim()

  if (!brand && !plate && !color) return null

  return { brand, plate, color }
}

function resolveDriverVehicle(order) {
  if (!order) return null
  if (order.driverVehicle) return order.driverVehicle

  if (config.useCloud) return null

  try {
    const { getMockTestUsers } = require('../auth/mock-users')
    const driverPreset = getMockTestUsers().find((user) => user.identities.includes('owner'))
    return snapshotDriverVehicle(driverPreset && driverPreset.vehicle)
  } catch (error) {
    return null
  }
}

function buildDriverCard(order, isPassenger) {
  if (!isPassenger || !order || !order.driverOpenId) {
    return { show: false }
  }
  if (!DRIVER_CARD_STATUSES.includes(order.status)) {
    return { show: false }
  }

  const vehicle = resolveDriverVehicle(order) || {}
  const brand = vehicle.brand || ''
  const plate = vehicle.plate || ''
  const color = vehicle.color || ''
  const vehicleLine = [brand, plate, color].filter(Boolean).join(' · ')

  return {
    show: true,
    driverName: order.driverName || '车主',
    brand,
    plate,
    color,
    vehicleLine: vehicleLine || '车辆信息待补充'
  }
}

module.exports = {
  snapshotDriverVehicle,
  resolveDriverVehicle,
  buildDriverCard
}
