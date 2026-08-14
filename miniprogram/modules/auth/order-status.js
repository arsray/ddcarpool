const STATUS = {
  MATCHING: '匹配中',
  WAITING: '待出发',
  TRIP: '行程中',
  DONE: '已完成',
  CLOSED: '已关闭'
}

const ONGOING_STATUSES = [STATUS.MATCHING, STATUS.WAITING, STATUS.TRIP]

const STATUS_CLASS = {
  [STATUS.MATCHING]: 'status-pub',
  [STATUS.WAITING]: 'status-wait',
  [STATUS.TRIP]: 'status-ing',
  [STATUS.DONE]: 'status-done',
  [STATUS.CLOSED]: 'status-exp'
}

const FILTER_TABS = ['全部', '未完成', '已完成', '已关闭']

const FILTER_TO_STATUSES = {
  未完成: ONGOING_STATUSES,
  已完成: [STATUS.DONE],
  已关闭: [STATUS.CLOSED]
}

module.exports = {
  STATUS,
  ONGOING_STATUSES,
  STATUS_CLASS,
  FILTER_TABS,
  FILTER_TO_STATUSES
}
