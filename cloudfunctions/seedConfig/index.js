// SECURITY-REVIEW: 仅 ADMIN_OPENIDS 中的维护者可写入配置种子。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const POINTS = [
  ['poi-01', '米奇大街'], ['poi-02', '演职人员活动中心'], ['poi-03', '迪士尼团队大楼'],
  ['poi-04', '宝藏湾'], ['poi-05', '中央厨房（北门）'], ['poi-06', '项目行政楼'],
  ['poi-07', '娱乐演出大楼'], ['poi-08', '西门'], ['poi-09', '明日世界'],
  ['poi-10', '迪士尼乐园酒店'], ['poi-11', '玩具总动员酒店'], ['poi-12', '申迪文化中心'],
  ['poi-13', '迪心楼'], ['poi-14', '比斯特'], ['poi-15', '羽托邦']
].map(([pointId, name], index) => ({ pointId, name, sortOrder: index + 1, enabled: true }))

const ROUTES = [
  {
    routeId: 'backstage-master',
    name: 'Backstage 主走廊',
    pointIds: POINTS.map((item) => item.pointId),
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

function allowed(openId) {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .includes(openId)
}

async function upsert(collectionName, key, rows) {
  const collection = db.collection(collectionName)
  for (const row of rows) {
    const existing = await collection.where({ [key]: row[key] }).limit(1).get()
    if (existing.data[0]) {
      await collection.doc(existing.data[0]._id).update({
        data: { ...row, updatedAt: db.serverDate() }
      })
    } else {
      await collection.add({
        data: { ...row, createdAt: db.serverDate(), updatedAt: db.serverDate() }
      })
    }
  }
}

exports.main = async () => {
  try {
    const { OPENID } = cloud.getWXContext()
    if (!OPENID || !allowed(OPENID)) {
      return { ok: false, code: 'FORBIDDEN', message: '无权执行配置初始化' }
    }
    await upsert('points', 'pointId', POINTS)
    await upsert('configured_routes', 'routeId', ROUTES)
    return { ok: true, data: { points: POINTS.length, routes: ROUTES.length } }
  } catch (error) {
    console.error('[seedConfig] failed', { name: error && error.name })
    return { ok: false, code: 'SEED_FAILED', message: '配置初始化失败' }
  }
}
