/** @file 默认 POI — 无云库 points 数据时使用 */

const DEFAULT_POINTS = [
  { pointId: 'parking-a', name: '停车场 A 区', sortOrder: 1, enabled: true },
  { pointId: 'parking-b', name: '停车场 B 区', sortOrder: 2, enabled: true },
  { pointId: 'metro-11', name: '11 号线迪士尼站', sortOrder: 3, enabled: true },
  { pointId: 'cast-gate', name: '演职人员通道', sortOrder: 4, enabled: true },
  { pointId: 'office-tower', name: '行政办公楼', sortOrder: 5, enabled: true },
  { pointId: 'hotel-shdr', name: '度假区酒店区', sortOrder: 6, enabled: true }
]

function getPointById(pointId) {
  return DEFAULT_POINTS.find((p) => p.pointId === pointId && p.enabled !== false)
}

module.exports = {
  DEFAULT_POINTS,
  getPointById
}
