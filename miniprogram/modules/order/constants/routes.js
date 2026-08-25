/** @file 配置路线种子 — 顺路计算 P0（pointIds 顺序与 POI sortOrder 对齐） */

const DEFAULT_CONFIGURED_ROUTES = [
  {
    routeId: 'backstage-master',
    name: 'Backstage 主走廊',
    pointIds: [
      'poi-01', 'poi-02', 'poi-03', 'poi-04', 'poi-05', 'poi-06',
      'poi-07', 'poi-08', 'poi-09', 'poi-10', 'poi-11', 'poi-12',
      'poi-13', 'poi-14', 'poi-15'
    ],
    enabled: true
  },
  {
    routeId: 'park-core',
    name: '园区核心动线',
    pointIds: ['poi-01', 'poi-02', 'poi-03', 'poi-04', 'poi-07', 'poi-08', 'poi-09'],
    enabled: true
  },
  {
    routeId: 'hotel-external',
    name: '酒店与外区',
    pointIds: ['poi-08', 'poi-10', 'poi-11', 'poi-12', 'poi-13', 'poi-14', 'poi-15'],
    enabled: true
  }
]

module.exports = {
  DEFAULT_CONFIGURED_ROUTES
}
