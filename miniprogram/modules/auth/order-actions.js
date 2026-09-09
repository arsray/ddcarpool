const { STATUS } = require('./order-status')

const ACTION_KEY = {
  REPUBLISH: 'republish',
  CHAT: 'chat',
  EDIT: 'edit',
  ACCEPT: 'accept',
  COMPLETE: 'complete',
  CANCEL_PASSENGER: 'cancel_passenger',
  CANCEL_DRIVER: 'cancel_driver'
}

const LABEL_TO_KEY = {
  再来一单: ACTION_KEY.REPUBLISH,
  '进入 Chat': ACTION_KEY.CHAT,
  编辑: ACTION_KEY.EDIT,
  确认接单: ACTION_KEY.ACCEPT,
  完成: ACTION_KEY.COMPLETE,
  取消搭车单: ACTION_KEY.CANCEL_PASSENGER,
  取消匹配: ACTION_KEY.CANCEL_DRIVER
}

const DANGER_ACTIONS = ['取消搭车单', '取消匹配']
const PRIMARY_ACTIONS = ['确认接单', '完成']
const SUCCESS_ACTIONS = ['进入 Chat']
const CANCEL_ACTION_KEYS = [ACTION_KEY.CANCEL_PASSENGER, ACTION_KEY.CANCEL_DRIVER]

/** 详情页操作按钮（匹配中车主 3 个，其余最多 2 个） */
function statusActions(order, role) {
  const status = order.status
  const isOwner = role === 'owner'

  if (status === STATUS.MATCHING) {
    if (isOwner) {
      return []
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
      return ['进入 Chat']
    }
    return ['进入 Chat', '再来一单']
  }

  if (status === STATUS.CLOSED) {
    if (!isOwner) {
      return ['再来一单']
    }
  }

  return []
}

function isDangerAction(action) {
  return DANGER_ACTIONS.includes(action)
}

/**
 * 统一详情页底部按钮：M1 规则 + M3 生命周期（接单/完成）
 * @param {{ canAccept?: boolean, canComplete?: boolean }} lifecycle
 */
function buildDetailActions(order, role, lifecycle = {}) {
  const { canAccept, canComplete } = lifecycle
  let labels = statusActions(order, role).slice()

  if (canComplete && !labels.includes('完成')) {
    labels.unshift('完成')
  }
  if (canAccept) {
    labels.unshift('确认接单')
  }

  return labels.map((label) => ({
    key: LABEL_TO_KEY[label] || label,
    label,
    danger: DANGER_ACTIONS.includes(label),
    success: SUCCESS_ACTIONS.includes(label),
    primary: PRIMARY_ACTIONS.includes(label)
  }))
}

module.exports = {
  statusActions,
  buildDetailActions,
  isDangerAction,
  ACTION_KEY,
  LABEL_TO_KEY,
  CANCEL_ACTION_KEYS,
  DANGER_ACTIONS,
  PRIMARY_ACTIONS,
  SUCCESS_ACTIONS
}
