/** @file 默认 POI — 无云库 points 数据时使用
 * sortOrder / pointId 序号供路线规划；name 为选择器展示文案（不含列表序号）
 */

const DEFAULT_POINTS = [
  { pointId: 'poi-01', name: '米奇大街', sortOrder: 1, enabled: true },
  { pointId: 'poi-02', name: '演职人员活动中心', sortOrder: 2, enabled: true },
  { pointId: 'poi-03', name: '迪士尼团队大楼', sortOrder: 3, enabled: true },
  { pointId: 'poi-04', name: '宝藏湾', sortOrder: 4, enabled: true },
  { pointId: 'poi-05', name: '中央厨房（北门）', sortOrder: 5, enabled: true },
  { pointId: 'poi-06', name: '项目行政楼', sortOrder: 6, enabled: true },
  { pointId: 'poi-07', name: '娱乐演出大楼', sortOrder: 7, enabled: true },
  { pointId: 'poi-08', name: '西门', sortOrder: 8, enabled: true },
  { pointId: 'poi-09', name: '明日世界', sortOrder: 9, enabled: true },
  { pointId: 'poi-10', name: '迪士尼乐园酒店', sortOrder: 10, enabled: true },
  { pointId: 'poi-11', name: '玩具总动员酒店', sortOrder: 11, enabled: true },
  { pointId: 'poi-12', name: '申迪文化中心', sortOrder: 12, enabled: true },
  { pointId: 'poi-13', name: '比斯特', sortOrder: 13, enabled: true },
  { pointId: 'poi-14', name: '羽托邦', sortOrder: 14, enabled: true }
]

function getPointById(pointId) {
  return DEFAULT_POINTS.find((p) => p.pointId === pointId && p.enabled !== false)
}

module.exports = {
  DEFAULT_POINTS,
  getPointById
}
