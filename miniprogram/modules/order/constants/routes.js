/** @file 配置路线种子 — 顺路计算 P0 */

const DEFAULT_CONFIGURED_ROUTES = [
  {
    routeId: 'backstage-main',
    name: '主 backstage 走廊',
    pointIds: ['cast-gate', 'office-tower', 'parking-a', 'parking-b'],
    enabled: true
  },
  {
    routeId: 'to-metro',
    name: '往地铁站方向',
    pointIds: ['cast-gate', 'parking-a', 'metro-11'],
    enabled: true
  },
  {
    routeId: 'hotel-loop',
    name: '酒店区连线',
    pointIds: ['office-tower', 'hotel-shdr', 'parking-b'],
    enabled: true
  }
]

module.exports = {
  DEFAULT_CONFIGURED_ROUTES
}
