/**
 * 编辑订单依赖云函数 order · action=update
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const orderIndexPath = path.join(__dirname, '../../cloudfunctions/order/index.js')

describe('order 云函数 · 编辑订单', () => {
  it('exports main 并支持 action=update', () => {
    const source = fs.readFileSync(orderIndexPath, 'utf8')
    assert.match(source, /action === 'update'/)
    assert.match(source, /updateMatchingOrder/)
  })
})
