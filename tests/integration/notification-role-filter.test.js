/**
 * Tab「消息」— targetType 与车主/乘车人 Tab 过滤
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadModule } = require('../helpers/setup')

describe('notificationMatchesRole', () => {
  const { notificationMatchesRole } = loadModule('modules/auth/plaza-tab.js')

  it('targetType owner 仅匹配车主 Tab', () => {
    const item = { targetType: 'owner', title: '乘客已取消' }
    assert.equal(notificationMatchesRole(item, 'owner'), true)
    assert.equal(notificationMatchesRole(item, 'passenger'), false)
  })

  it('targetType passenger 仅匹配乘车人 Tab', () => {
    const item = { targetType: 'passenger', title: '司机已接单' }
    assert.equal(notificationMatchesRole(item, 'passenger'), true)
    assert.equal(notificationMatchesRole(item, 'owner'), false)
  })

  it('无 targetType 时两端均展示（兼容旧数据）', () => {
    const item = { title: 'legacy' }
    assert.equal(notificationMatchesRole(item, 'owner'), true)
    assert.equal(notificationMatchesRole(item, 'passenger'), true)
  })
})
