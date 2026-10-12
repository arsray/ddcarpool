/** POI / 内联下拉：blur 延迟；浮层滚动时勿因 input blur 误关菜单 */
const BLUR_DELAY_MS = 520

function lockPickerTap(page) {
  page._poiPickerTapLock = true
}

function onSuggestionTouchStart(page) {
  lockPickerTap(page)
}

function markFloatMenuTouch(page) {
  lockPickerTap(page)
  page._floatMenuTouchActive = true
  if (page._floatMenuTouchEndTimer) {
    clearTimeout(page._floatMenuTouchEndTimer)
    page._floatMenuTouchEndTimer = null
  }
}

function scheduleFloatMenuTouchEnd(page, delayMs = 560) {
  if (page._floatMenuTouchEndTimer) {
    clearTimeout(page._floatMenuTouchEndTimer)
  }
  page._floatMenuTouchEndTimer = setTimeout(() => {
    page._floatMenuTouchActive = false
    page._floatMenuTouchEndTimer = null
  }, delayMs)
}

function shouldDeferPoiBlur(page) {
  return Boolean(page._poiPickerTapLock || page._floatMenuTouchActive)
}

function runAfterBlur(fn) {
  return setTimeout(fn, BLUR_DELAY_MS)
}

module.exports = {
  BLUR_DELAY_MS,
  lockPickerTap,
  onSuggestionTouchStart,
  markFloatMenuTouch,
  scheduleFloatMenuTouchEnd,
  shouldDeferPoiBlur,
  runAfterBlur
}
