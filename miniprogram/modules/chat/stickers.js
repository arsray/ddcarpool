/**
 * M4 — 恶搞文字表情（本地静态资源）
 */

const STICKERS = [
  {
    id: 'no_work',
    label: '你没活儿么',
    src: '/assets/chat/stickers/sticker-no-work.png'
  },
  {
    id: 'review_prd',
    label: '还在和老板 review PRD',
    src: '/assets/chat/stickers/sticker-review-prd.png'
  },
  {
    id: 'l9',
    label: '理想L9?',
    src: '/assets/chat/stickers/sticker-l9.png'
  },
  {
    id: 'eye_hint',
    label: '给你个眼神自己体会',
    src: '/assets/chat/stickers/sticker-eye-hint.jpg'
  },
  {
    id: 'what_happened',
    label: '怎么回事！',
    src: '/assets/chat/stickers/sticker-what-happened.jpg'
  },
  {
    id: 'speechless',
    label: '？？？',
    src: '/assets/chat/stickers/sticker-speechless.jpg'
  }
]

const STICKER_MAP = new Map(STICKERS.map((item) => [item.id, item]))

/** 与 chat.wxss 中 --sticker-* 变量保持一致 */
const STICKER_PANEL = {
  columns: 3,
  rowHeightRpx: 204,
  rowGapRpx: 16,
  visibleRows: 2,
  sheetPaddingRpx: 32
}

/** 云函数侧 allowlist 须与此 id 列表一致 */
const STICKER_IDS = STICKERS.map((item) => item.id)

function calcStickerRowCount(stickerCount) {
  const count = Math.max(0, Number(stickerCount) || 0)
  if (!count) return 0
  return Math.ceil(count / STICKER_PANEL.columns)
}

function calcStickerGridHeightRpx(stickerCount) {
  const rows = calcStickerRowCount(stickerCount)
  if (!rows) return 0
  return rows * STICKER_PANEL.rowHeightRpx + (rows - 1) * STICKER_PANEL.rowGapRpx
}

function buildStickerGridStyle(stickerCount) {
  const minHeight = calcStickerGridHeightRpx(stickerCount)
  return minHeight ? `min-height: ${minHeight}rpx;` : ''
}

function getStickerPanelMetrics() {
  const { visibleRows, rowHeightRpx, rowGapRpx, sheetPaddingRpx } = STICKER_PANEL
  const scrollHeightRpx = visibleRows * rowHeightRpx + (visibleRows - 1) * rowGapRpx
  return {
    ...STICKER_PANEL,
    scrollHeightRpx,
    sheetHeightRpx: scrollHeightRpx + sheetPaddingRpx
  }
}

function listStickers() {
  return STICKERS.map((item) => ({ ...item }))
}

function getStickerById(stickerId) {
  return STICKER_MAP.get(String(stickerId || '').trim()) || null
}

function getStickerByLabel(label) {
  const text = String(label || '').trim()
  if (!text) return null
  return STICKERS.find((item) => item.label === text) || null
}

function resolveStickerFromMessage(item) {
  if (!item) return null
  const byId = getStickerById(item.stickerId)
  if (byId) return byId
  if (item.type === 'sticker') {
    return getStickerByLabel(item.content)
  }
  return getStickerByLabel(item.content)
}

module.exports = {
  STICKER_PANEL,
  STICKER_IDS,
  listStickers,
  getStickerById,
  getStickerByLabel,
  resolveStickerFromMessage,
  buildStickerGridStyle,
  getStickerPanelMetrics
}
