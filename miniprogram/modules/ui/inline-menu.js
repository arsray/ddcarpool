/** 内联下拉：真机 scroll-view 需固定 px 高度；浮层锚定到字段下方 */

function menuHeightPx(heightRpx = 320) {
  const { windowWidth } = wx.getWindowInfo()
  return Math.round((heightRpx * windowWidth) / 750)
}

function measureAnchorRect(page, selector) {
  return new Promise((resolve) => {
    wx.createSelectorQuery()
      .in(page)
      .select(selector)
      .boundingClientRect()
      .exec((res) => {
        resolve(res && res[0] ? res[0] : null)
      })
  })
}

/** 菜单始终锚在字段正下方；键盘挡住底部一段可接受 */
function layoutMenuBelowField(rect) {
  return {
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width
  }
}

function scrollPageToRevealRect(page, rect, menuHeightPxValue, keyboardHeightPx = 0) {
  if (!rect) return Promise.resolve()

  const keyboard = Math.max(0, keyboardHeightPx || 0)
  const windowHeight = wx.getWindowInfo().windowHeight
  const visibleBottom = windowHeight - keyboard
  const needBottom = rect.bottom + menuHeightPxValue + 16

  if (needBottom <= visibleBottom) return Promise.resolve()

  return new Promise((resolve) => {
    wx.createSelectorQuery()
      .in(page)
      .selectViewport()
      .scrollOffset()
      .exec((res) => {
        const scroll = res && res[0]
        if (!scroll) {
          resolve()
          return
        }
        const delta = needBottom - visibleBottom
        wx.pageScrollTo({
          scrollTop: scroll.scrollTop + delta,
          duration: 200,
          complete: () => setTimeout(resolve, 220)
        })
      })
  })
}

function poiCursorSpacingPx(menuHeightPxValue) {
  return menuHeightPxValue + 48
}

module.exports = {
  menuHeightPx,
  measureAnchorRect,
  layoutMenuBelowField,
  scrollPageToRevealRect,
  poiCursorSpacingPx
}
