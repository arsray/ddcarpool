/**
 * 邮箱账号 ID — 与云函数 account-id 算法一致
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { loadModule } = require('../helpers/setup')

describe('emailToAccountId', () => {
  const { emailToAccountId } = loadModule('modules/auth/email.js')

  it('crystal.x.wu 与 crystal 为不同账号', () => {
    const a = emailToAccountId('crystal.x.wu@disney.com')
    const b = emailToAccountId('crystal@disney.com')
    assert.notEqual(a, b)
    assert.match(a, /^acct_/)
    assert.match(b, /^acct_/)
  })
})
