/**
 * POI 搜索 — 名称 / 别名 / 拼音首字母
 */

const { DEFAULT_POINTS } = require('./constants/points')

/** @type {Record<string, { aliases?: string[], initials?: string[] }>} */
const POINT_SEARCH_META = {
  'poi-01': { aliases: ['203', '米奇'], initials: ['mqdj', 'mlx'] },
  'poi-02': { aliases: ['603'], initials: ['yjryhdzx'] },
  'poi-03': { aliases: ['TD', '团队', '团队大楼'], initials: ['dsntddil', 'tddil'] },
  'poi-04': { aliases: ['TG', 'Pirates', '615', '安保大楼'], initials: ['bzw', 'abdl'] },
  'poi-05': { aliases: ['北门', 'CPK'], initials: ['zycf', 'zycfbm', 'bm'] },
  'poi-06': { aliases: ['PAB', '项目'], initials: ['xmxzl', 'xm'] },
  'poi-07': { aliases: ['ENT', '604'], initials: ['ylycdil', 'yl'] },
  'poi-08': { aliases: [], initials: ['xm'] },
  'poi-09': { aliases: ['TL', '史迪奇'], initials: ['mrsj', 'sdq'] },
  'poi-10': { aliases: ['乐园', 'H1'], initials: ['dslyjd', 'ly'] },
  'poi-11': { aliases: ['玩总', 'H2'], initials: ['wjzbsjd', 'wz'] },
  'poi-12': { aliases: ['申迪'], initials: ['sdwhzx', 'sd'] },
  'poi-13': { aliases: ['小白楼'], initials: ['dxl', 'xbl'] },
  'poi-14': { aliases: ['苏小柳'], initials: ['bst', 'sxl'] },
  'poi-15': { aliases: [], initials: ['ytb'] }
}

function normalizeLatin(value) {
  return String(value || '').trim().toLowerCase()
}

function enrichPointForSearch(point) {
  const meta = POINT_SEARCH_META[point.pointId] || {}
  const aliases = meta.aliases || []
  const initials = meta.initials || []
  const aliasHint = aliases.length ? aliases.join(' / ') : ''

  return {
    ...point,
    aliases,
    initials,
    aliasHint,
    searchTokens: [
      point.name,
      ...aliases,
      ...initials
    ]
  }
}

function getSearchablePoints(points) {
  return (points || DEFAULT_POINTS)
    .filter((point) => point.enabled !== false)
    .map(enrichPointForSearch)
}

function pointMatchesQuery(point, rawQuery) {
  const query = String(rawQuery || '').trim()
  if (!query) return true

  const latinQuery = normalizeLatin(query)
  const enriched = point.aliases ? point : enrichPointForSearch(point)

  if (enriched.name.includes(query)) return true

  return enriched.searchTokens.some((token) => {
    if (!token) return false
    if (String(token).includes(query)) return true
    const latinToken = normalizeLatin(token)
    if (!latinQuery) return false
    return latinToken.includes(latinQuery) || latinToken.startsWith(latinQuery)
  })
}

function filterPoints(points, rawQuery, limit) {
  const list = getSearchablePoints(points)
  const query = String(rawQuery || '').trim()
  const max = typeof limit === 'number' ? limit : list.length

  if (!query) return list.slice(0, max)

  return list.filter((point) => pointMatchesQuery(point, query)).slice(0, max)
}

function getPointDisplayName(points, pointId) {
  const point = (points || []).find((item) => item.pointId === pointId)
  return point ? point.name : ''
}

function findPointByQuery(points, rawQuery) {
  const query = String(rawQuery || '').trim()
  if (!query) return null

  const list = getSearchablePoints(points)
  const exactName = list.find((point) => point.name === query)
  if (exactName) return exactName

  const latinQuery = normalizeLatin(query)
  const exactAlias = list.find((point) =>
    point.aliases.some((alias) => normalizeLatin(alias) === latinQuery || alias === query)
  )
  if (exactAlias) return exactAlias

  const matches = list.filter((point) => pointMatchesQuery(point, query))
  return matches.length === 1 ? matches[0] : null
}

function resolvePointIds(pointId, query, points) {
  if (pointId) return [pointId]
  const trimmed = String(query || '').trim()
  if (!trimmed) return null
  const matched = filterPoints(points, trimmed, 15).map((point) => point.pointId)
  return matched.length ? matched : ['__no_match__']
}

module.exports = {
  POINT_SEARCH_META,
  enrichPointForSearch,
  getSearchablePoints,
  filterPoints,
  findPointByQuery,
  getPointDisplayName,
  pointMatchesQuery,
  resolvePointIds
}
