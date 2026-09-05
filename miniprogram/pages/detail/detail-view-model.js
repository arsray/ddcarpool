/**
 * 订单详情页 · 文案 & CTA（产品配置）
 */

const { ORDER_STATUS } = require('../../modules/order/constants/status')
const { CANCEL_KIND } = require('../../modules/order/cancel-flow')

const DEFAULT_CTA_LABELS = {
  accept: '确认接单',
  start: '开始行程',
  complete: '完成',
  cancel_passenger: '取消搭车单',
  cancel_driver: '取消匹配',
  chat: '联系同行人',
  history: '查看我的订单',
  plaza: '返回广场'
}

const CTA_VARIANT = {
  accept: 'accent',
  start: 'primary',
  complete: 'secondary',
  cancel_passenger: 'danger',
  cancel_driver: 'danger',
  chat: 'secondary',
  history: 'secondary',
  plaza: 'secondary'
}

const SUBMITTING_ACTIONS = new Set([
  'accept',
  'start',
  'complete',
  'cancel_passenger',
  'cancel_driver'
])

/** @type {Record<string, Record<'passenger'|'driver', { roleLabel: string, statusTitle: string, statusHint: string, ctas: { key: string, label?: string }[] }>>} */
const DETAIL_COPY = {
  matching: {
    passenger: {
      roleLabel: '我发布的',
      statusTitle: '匹配中',
      statusHint: '等待司机在广场接单',
      ctas: [{ key: 'cancel_passenger' }, { key: 'history' }]
    },
    driver: {
      roleLabel: '顺路订单',
      statusTitle: '匹配中',
      statusHint: '确认顺路后可接单',
      ctas: [
        { key: 'accept' },
        { key: 'plaza' }
      ]
    }
  },
  pending_departure: {
    passenger: {
      roleLabel: '我发布的',
      statusTitle: '待出发',
      statusHint: '司机已接单，请留意出发时间',
      ctas: [
        { key: 'chat', label: '联系车主' },
        { key: 'history' },
        { key: 'cancel_passenger' }
      ]
    },
    driver: {
      roleLabel: '我已接单',
      statusTitle: '待出发',
      statusHint: '请按出发时间窗接上乘客',
      ctas: [
        { key: 'chat', label: '联系乘客' },
        { key: 'complete', label: '订单完成' },
        { key: 'plaza' },
        { key: 'history' },
        { key: 'cancel_driver', label: '取消接单' }
      ],
      actionRows: [
        ['chat', 'complete'],
        ['history', 'plaza']
      ]
    }
  },
  in_progress: {
    passenger: {
      roleLabel: '我发布的',
      statusTitle: '行程中',
      statusHint: '行程进行中',
      ctas: [{ key: 'chat', label: '联系车主' }, { key: 'history' }]
    },
    driver: {
      roleLabel: '我已接单',
      statusTitle: '行程中',
      statusHint: '行程进行中',
      ctas: [
        { key: 'complete' },
        { key: 'chat', label: '联系乘客' },
        { key: 'plaza' },
        { key: 'history' }
      ]
    }
  },
  completed: {
    passenger: {
      roleLabel: '我发布的',
      statusTitle: '已完成',
      statusHint: '本单已顺利完成',
      ctas: [{ key: 'history' }]
    },
    driver: {
      roleLabel: '我已接单',
      statusTitle: '已完成',
      statusHint: '本单已顺利完成',
      ctas: [{ key: 'history' }, { key: 'plaza' }]
    }
  },
  closed: {
    passenger: {
      roleLabel: '我发布的',
      statusTitle: '已关闭',
      statusHint: '订单已关闭',
      ctas: [{ key: 'history' }]
    },
    driver: {
      roleLabel: '我已接单',
      statusTitle: '已关闭',
      statusHint: '订单已关闭',
      ctas: [{ key: 'history' }, { key: 'plaza' }]
    }
  }
}

function resolvePerspective({ isPassenger, isAssignedDriver, canAccept }) {
  if (isPassenger) return 'passenger'
  if (isAssignedDriver || canAccept) return 'driver'
  return null
}

function isCtaAvailable(key, ctx) {
  switch (key) {
    case 'accept':
      return ctx.canAccept
    case 'start':
      return ctx.canStart
    case 'complete':
      return ctx.canComplete
    case 'cancel_passenger':
      return ctx.cancelKind === CANCEL_KIND.PASSENGER_CANCEL
    case 'cancel_driver':
      return ctx.cancelKind === CANCEL_KIND.DRIVER_RELEASE
    case 'chat':
      return ctx.canChat
    case 'history':
      return ctx.isPassenger || ctx.isAssignedDriver
    case 'plaza':
      return ctx.fromPlaza && ctx.status !== ORDER_STATUS.MATCHING
    default:
      return false
  }
}

function groupActions(actions) {
  const primary = []
  const secondary = []
  const danger = []

  actions.forEach((action) => {
    if (action.variant === 'accent' || action.variant === 'primary') {
      primary.push(action)
      return
    }
    if (action.variant === 'danger') {
      danger.push(action)
      return
    }
    secondary.push(action)
  })

  return { primary, secondary, danger }
}

function buildActionRows(actionRowsSpec, actionsByKey) {
  if (!actionRowsSpec || !actionRowsSpec.length) return []

  return actionRowsSpec
    .map((rowKeys) =>
      rowKeys.map((key) => actionsByKey[key]).filter(Boolean)
    )
    .filter((row) => row.length > 0)
}

function buildDetailViewModel(ctx) {
  const perspective = resolvePerspective(ctx)
  const copy = perspective ? DETAIL_COPY[ctx.status]?.[perspective] : null

  if (!copy) {
    return {
      roleLabel: '',
      statusLabel: ctx.fallbackStatusLabel || '',
      statusHint: '',
      actions: [],
      actionGroups: { primary: [], secondary: [], danger: [] },
      actionRows: []
    }
  }

  const actions = copy.ctas
    .filter((item) => isCtaAvailable(item.key, ctx))
    .map((item) => ({
      key: item.key,
      label: item.label || DEFAULT_CTA_LABELS[item.key] || item.key,
      variant: CTA_VARIANT[item.key] || 'secondary',
      submitting: SUBMITTING_ACTIONS.has(item.key)
    }))

  const actionsByKey = actions.reduce((map, action) => {
    map[action.key] = action
    return map
  }, {})

  const dangerActions = actions.filter((action) => action.variant === 'danger')
  const nonDangerActions = actions.filter((action) => action.variant !== 'danger')
  const actionRows = buildActionRows(copy.actionRows, actionsByKey)
  const actionGroups = actionRows.length
    ? { primary: [], secondary: nonDangerActions, danger: dangerActions }
    : groupActions(actions)

  return {
    roleLabel: copy.roleLabel,
    statusLabel: copy.statusTitle,
    statusHint: copy.statusHint,
    actions,
    actionGroups,
    actionRows
  }
}

module.exports = {
  DETAIL_COPY,
  groupActions,
  buildDetailViewModel
}
