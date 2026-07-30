/**
 * 默认固定点位 — M3 维护
 * 云数据库 points 集合有数据时优先使用库内数据
 */
const DEFAULT_POINTS = [
  { pointId: 'parking-a', name: '停车场 A 区', sortOrder: 1 },
  { pointId: 'parking-b', name: '停车场 B 区', sortOrder: 2 },
  { pointId: 'metro-11', name: '11 号线迪士尼站', sortOrder: 3 },
  { pointId: 'cast-gate', name: '演职人员通道', sortOrder: 4 },
  { pointId: 'office-tower', name: '行政办公楼', sortOrder: 5 },
  { pointId: 'hotel-shdr', name: '度假区酒店区', sortOrder: 6 }
]

const ORDER_TYPES = [
  { value: 'seek', label: '求蹭车' },
  { value: 'offer', label: '可捎带' }
]

const ORDER_STATUS = [
  { value: 'open', label: '待接取' },
  { value: 'matched', label: '已匹配' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' }
]

module.exports = {
  DEFAULT_POINTS,
  ORDER_TYPES,
  ORDER_STATUS
}
