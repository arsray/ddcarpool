/**
 * 订单列表 / 详情展示文案（方案 B：乘车人侧标「车主」，车主侧乘客信息）
 */
const { STATUS } = require('./order-status')

function formatScheduleLine(order) {
  if (order.dateLabel && order.timeLabel) {
    return `${order.dateLabel} · ${order.timeLabel}`
  }
  return order.time || ''
}

function truncateNote(note, maxLen) {
  if (!note || !note.trim()) return ''
  const val = note.trim()
  if (val.length <= maxLen) return val
  return `${val.slice(0, maxLen)}…`
}

function getOwnerSourceTag(order, role) {
  if (role !== 'owner' || !order.createdFrom) return ''
  return order.createdFrom === 'publish' ? '发布' : '接单'
}

/** 详情页状态行二级文案（与一级状态同排展示） */
function formatStatusSubline(order, role) {
  if (!order) return ''

  if (order.status === STATUS.MATCHING) {
    return role === 'owner' ? '等待匹配' : '等待车主接单'
  }

  if (order.status === STATUS.CLOSED) {
    return order.closedReason || ''
  }

  if (order.status === STATUS.WAITING) {
    if (role === 'passenger' && order.partnerName) {
      return `车主 ${order.partnerName} 已接单`
    }
    if (role === 'owner' && order.partnerName) {
      const count = order.count != null && order.count > 0 ? order.count : 1
      return `乘客 ${order.partnerName} ${count} 人`
    }
  }

  if (order.status === STATUS.TRIP && order.partnerName) {
    if (role === 'passenger') {
      return `车主 ${order.partnerName} · 同行`
    }
    const count = order.count != null && order.count > 0 ? order.count : 1
    return `乘客 ${order.partnerName} ${count} 人 · 同行`
  }

  return ''
}

/** 列表第三行：身份/匹配/关闭原因（不含状态 Tag） */
function formatListHint(order, role) {
  if (!order) return ''

  if (order.status === STATUS.MATCHING) {
    return role === 'owner' ? '等待匹配' : '等待车主接单'
  }

  if (order.status === STATUS.CLOSED) {
    return order.closedReason || ''
  }

  if (role === 'passenger') {
    if (order.status === STATUS.WAITING && order.partnerName) {
      const vehicleSuffix = order.vehicleLine ? ` · ${order.vehicleLine}` : ''
      return `车主 ${order.partnerName} 已接单${vehicleSuffix}`
    }
    if (order.status === STATUS.TRIP && order.partnerName) {
      const vehicleSuffix = order.vehicleLine ? ` · ${order.vehicleLine}` : ''
      return `车主 ${order.partnerName} · 同行${vehicleSuffix}`
    }
    return ''
  }

  if (order.partnerName) {
    const count = order.count != null && order.count > 0 ? order.count : 1
    let hint = `乘客 ${order.partnerName} ${count} 人`
    const noteShort = truncateNote(order.note, 8)
    if (noteShort && order.status !== STATUS.DONE) {
      hint += ` · ${noteShort}`
    }
    return hint
  }

  return ''
}

function enrichOrderForList(item, role) {
  return {
    ...item,
    scheduleLine: formatScheduleLine(item),
    listHint: formatListHint(item, role),
    sourceTag: getOwnerSourceTag(item, role)
  }
}

/**
 * 详情页字段块：状态行（独立）→ 出发 → 路线 → 其他
 */
function buildDetailView(order, role) {
  const isOwner = role === 'owner'
  const navTitle = isOwner ? '车主订单详情' : '乘车人订单详情'
  const sections = []

  sections.push({
    label: '出发',
    value: formatScheduleLine(order)
  })

  sections.push({
    label: '路线',
    value: `${order.from} → ${order.to}`
  })

  if (isOwner) {
    if (order.status === STATUS.MATCHING && order.capacity != null) {
      sections.push({
        label: '可载',
        value: `${order.capacity} 人`
      })
    }
    if (order.note && order.note.trim()) {
      sections.push({
        label: '备注',
        value: order.note.trim()
      })
    }
  } else {
    sections.push({
      label: '人数',
      value: `${order.count || 1} 人`
    })
    if (order.note && order.note.trim()) {
      sections.push({
        label: '备注',
        value: order.note.trim()
      })
    }
  }

  return {
    navTitle,
    sections,
    sourceTag: getOwnerSourceTag(order, role),
    statusSubline: formatStatusSubline(order, role)
  }
}

module.exports = {
  formatScheduleLine,
  formatListHint,
  formatStatusSubline,
  getOwnerSourceTag,
  enrichOrderForList,
  buildDetailView,
  truncateNote
}
