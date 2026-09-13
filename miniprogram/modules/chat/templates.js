/**
 * M4 — 对话模板库（乘客 / 司机分组）
 * 产品来源：迪迪-Chat PRD §4.4.2
 */

const PASSENGER_GROUPS = [
  {
    id: 'pickup',
    label: '上车确认',
    icon: '📍',
    items: [
      { id: 'p_pickup_1', text: '我到了，在PAB正门口等你～' },
      { id: 'p_pickup_2', text: '我穿史迪奇衣服，很好认！' }
    ]
  },
  {
    id: 'time',
    label: '时间沟通',
    icon: '⏰',
    items: [
      { id: 'p_time_1', text: '可以晚 5 分钟出发吗？抱歉！' },
      { id: 'p_time_2', text: '你大概几点到？' }
    ]
  },
  {
    id: 'seat',
    label: '座位管理',
    icon: '💺',
    items: [
      { id: 'p_seat_1', text: '还有副驾座位吗？' },
      { id: 'p_seat_2', text: '我想坐后备箱可以吗？' }
    ]
  },
  {
    id: 'request',
    label: '特殊请求',
    icon: '🙏',
    items: [
      { id: 'p_req_1', text: '可以顺路停一下全家便利店吗？' },
      { id: 'p_req_2', text: '我带了榴莲，味道不大的～' },
      { id: 'p_req_3', text: '理想L9？' },
      { id: 'p_req_4', text: '买了特卖，可以帮忙运么？' },
      { id: 'p_req_5', text: '提前开空调？' }
    ]
  },
  {
    id: 'social',
    label: '互动寒暄',
    icon: '😊',
    items: [
      { id: 'p_soc_1', text: '下午好呀～' },
      { id: 'p_soc_2', text: '骑自行车都比你开的快！' }
    ]
  },
  {
    id: 'arrival',
    label: '到达确认',
    icon: '🏁',
    items: [
      { id: 'p_arr_1', text: '再坐你车劳资是！' },
      { id: 'p_arr_2', text: '辛苦了，下次再来蹭车！' }
    ]
  }
]

const DRIVER_GROUPS = [
  {
    id: 'depart',
    label: '出发通知',
    icon: '🚗',
    items: [
      { id: 'd_dep_1', text: '我出发了，5 分钟后到！' },
      { id: 'd_dep_2', text: '已到达上车点，车牌号 8177' }
    ]
  },
  {
    id: 'time',
    label: '时间沟通',
    icon: '⏰',
    items: [
      { id: 'd_time_1', text: '堵车了，预计晚 15 分钟' },
      { id: 'd_time_2', text: '还在和老板review PRD，晚点出发？' }
    ]
  },
  {
    id: 'seat',
    label: '座位管理',
    icon: '💺',
    items: [
      { id: 'd_seat_1', text: '还有 2 个座位，快来！' },
      { id: 'd_seat_2', text: '座位已满，下次早点哦' }
    ]
  },
  {
    id: 'request',
    label: '特殊请求',
    icon: '🙏',
    items: [
      { id: 'd_req_1', text: '可以给我写个recognition么？' },
      { id: 'd_req_2', text: '可以弹射后排乘客么？' },
      { id: 'd_req_3', text: '请不要在车上吃东西' }
    ]
  },
  {
    id: 'social',
    label: '互动寒暄',
    icon: '😊',
    items: [
      { id: 'd_soc_1', text: '早上好呀～' },
      { id: 'd_soc_2', text: '今天天气真不错' },
      { id: 'd_soc_3', text: '坐稳了，老司机要发车了🚀' }
    ]
  },
  {
    id: 'arrival',
    label: '到达确认',
    icon: '🏁',
    items: [
      { id: 'd_arr_1', text: '到达目的地～欢迎下次再蹭！' },
      { id: 'd_arr_2', text: '给劳资好评好评⭐⭐⭐⭐⭐' }
    ]
  }
]

/** 快捷栏展示的模板 id（一键发送） */
const QUICK_IDS = {
  passenger: ['p_pickup_1', 'p_time_1', 'p_seat_1', 'p_soc_1', 'p_arr_2'],
  driver: ['d_dep_1', 'd_time_1', 'd_seat_1', 'd_soc_1', 'd_arr_1']
}

const LIBRARY = {
  passenger: PASSENGER_GROUPS,
  driver: DRIVER_GROUPS
}

function resolveChatRole(order, openId) {
  if (!order || !openId) return null
  if (order.viewerRole === 'passenger' || order.viewerRole === 'driver') {
    return order.viewerRole
  }
  if (order.passengerOpenId === openId) return 'passenger'
  if (order.driverOpenId === openId) return 'driver'
  return null
}

function flattenGroups(groups) {
  const map = new Map()
  groups.forEach((group) => {
    group.items.forEach((item) => {
      map.set(item.id, { ...item, groupLabel: group.label, groupIcon: group.icon })
    })
  })
  return map
}

function getMessageTemplates(role) {
  const key = role === 'driver' ? 'driver' : 'passenger'
  const groups = LIBRARY[key]
  const byId = flattenGroups(groups)
  const quickIds = QUICK_IDS[key] || []
  const quickTemplates = quickIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((item) => ({
      id: item.id,
      text: item.text,
      label: item.text.length > 14 ? `${item.text.slice(0, 14)}…` : item.text
    }))

  return {
    role: key,
    roleLabel: key === 'driver' ? '司机' : '乘客',
    quickTemplates,
    templateGroups: groups
  }
}

function buildTemplateTextSet(role) {
  const { templateGroups } = getMessageTemplates(role)
  const texts = new Set()
  templateGroups.forEach((group) => {
    group.items.forEach((item) => texts.add(item.text))
  })
  return texts
}

module.exports = {
  resolveChatRole,
  getMessageTemplates,
  buildTemplateTextSet
}
