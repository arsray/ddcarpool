const { STATUS } = require('./order-status')

const DANGER_ACTIONS = ['停止匹配', '取消搭车单', '取消匹配', '关闭发车单']

/** 详情页操作按钮（匹配中车主 3 个，其余最多 2 个） */
function statusActions(order, role) {
  const status = order.status
  const isOwner = role === 'owner'

  if (status === STATUS.MATCHING) {
    if (isOwner) {
      return ['查看匹配推荐', '编辑', '停止匹配']
    }
    return ['编辑', '取消搭车单']
  }

  if (status === STATUS.WAITING) {
    if (isOwner) {
      return ['进入 Chat', '取消匹配']
    }
    return ['进入 Chat', '取消搭车单']
  }

  if (status === STATUS.TRIP) {
    return ['进入 Chat']
  }

  if (status === STATUS.DONE) {
    if (isOwner) {
      if (order.createdFrom === 'publish') {
        return ['进入 Chat', '再发一单']
      }
      return ['进入 Chat']
    }
    return ['进入 Chat', '再来一单']
  }

  if (status === STATUS.CLOSED) {
    if (isOwner && order.createdFrom === 'publish') {
      return ['再发一单']
    }
    if (!isOwner) {
      return ['再来一单']
    }
  }

  return []
}

function isDangerAction(action) {
  return DANGER_ACTIONS.includes(action)
}

module.exports = {
  statusActions,
  isDangerAction,
  DANGER_ACTIONS
}
