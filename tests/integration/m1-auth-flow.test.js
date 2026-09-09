/**
 * M1 — 注册 / 登录 / 身份选择 / 模式切换
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  loadModule,
  withAuthStore,
  withOrderModule,
  simulatePassengerOnboarding,
  simulateOwnerOnboarding,
  ALICE,
  BOB
} = require('../helpers/setup')

const { sendCode, verifyCode, sendCodeLocal, verifyCodeLocal, getCooldownRemain } = loadModule('modules/auth/verify.js')
const { validateEmailPrefix } = loadModule('modules/auth/email.js')

describe('M1 邮箱注册 / 登录', () => {
  it('邮箱前缀校验通过 @disney.com', () => {
    const result = validateEmailPrefix('alice.passenger')
    assert.equal(result.ok, true)
    assert.equal(result.email, 'alice.passenger@disney.com')
  })

  it('非法邮箱前缀被拒绝', () => {
    const result = validateEmailPrefix('bad email!')
    assert.equal(result.ok, false)
  })

  it('发送验证码 → 页面预览码 → 校验通过', async () => {
    await withAuthStore({}, () => {
      const email = 'new.user@disney.com'
      const sent = sendCodeLocal(email)
      assert.equal(sent.ok, true)
      assert.match(sent.code, /^\d{6}$/)

      const verified = verifyCodeLocal(email, sent.code)
      assert.equal(verified.ok, true)
      assert.equal(verified.email, email)
    })
  })

  it('60s 内重复发送被拒绝', async () => {
    await withAuthStore({}, () => {
      const email = 'cooldown.user@disney.com'
      const first = sendCodeLocal(email)
      assert.equal(first.ok, true)
      assert.ok(getCooldownRemain(email) > 0)

      const second = sendCodeLocal(email)
      assert.equal(second.ok, false)
      assert.equal(second.code, 'cooldown')
      assert.ok(second.remain > 0)
    })
  })

  it('错误验证码登录失败', async () => {
    await withAuthStore({}, () => {
      sendCodeLocal('test.user@disney.com')
      const bad = verifyCodeLocal('test.user@disney.com', '000000')
      assert.equal(bad.ok, false)
    })
  })

  it('新用户首次登录 → 无身份，需走 onboarding', async () => {
    await withAuthStore({}, ({ store }) => {
      store.loginWithEmail('fresh.user@disney.com')
      const state = store.getState()
      assert.equal(state.identities.length, 0)
      assert.equal(state.onboardingComplete, false)
      assert.ok(store.getOpenId())
    })
  })

  it('老用户再次登录 → 保留身份与资料', async () => {
    await withAuthStore({}, ({ store, mockWx }) => {
      store.loginWithEmail('returning.user@disney.com')
      simulatePassengerOnboarding(store)
      mockWx.setStorageSync('loggedIn', false)

      store.loginWithEmail('returning.user@disney.com')
      const state = store.getState()
      assert.ok(state.identities.includes('passenger'))
      assert.equal(state.onboardingComplete, true)
    })
  })
})

describe('M1 身份选择与 onboarding', () => {
  it('选择乘车人 → 保存偏好 → onboarding 完成', async () => {
    await withAuthStore({}, ({ store }) => {
      store.loginWithEmail('passenger.only@disney.com')
      simulatePassengerOnboarding(store)
      const state = store.getState()
      assert.deepEqual(state.identities, ['passenger'])
      assert.equal(state.userMode, 'passenger')
      assert.ok(state.preference)
      assert.equal(state.onboardingComplete, true)
    })
  })

  it('选择车主 → 保存车辆 → onboarding 完成', async () => {
    await withAuthStore({}, ({ store }) => {
      store.loginWithEmail('driver.only@disney.com')
      simulateOwnerOnboarding(store)
      const state = store.getState()
      assert.deepEqual(state.identities, ['owner'])
      assert.equal(state.userMode, 'owner')
      assert.ok(state.vehicle && state.vehicle.plate)
    })
  })

  it('双身份用户可切换 userMode', async () => {
    await withAuthStore({}, ({ store }) => {
      store.loginWithEmail('dual.user@disney.com')
      simulatePassengerOnboarding(store)
      store.addIdentity('owner')
      store.saveVehicle({ brand: '特斯拉', plate: '沪B99999', passengerCapacity: 4, color: '黑色' })

      store.setUserMode('owner')
      assert.equal(store.getState().userMode, 'owner')
      store.setUserMode('passenger')
      assert.equal(store.getState().userMode, 'passenger')
    })
  })

  it('Mock 账号 Alice / Bob 一键切换预设', async () => {
    await withAuthStore({}, ({ store }) => {
      store.switchMockUser(ALICE.email)
      assert.ok(store.hasIdentity('passenger'))
      assert.equal(store.hasIdentity('owner'), false)

      store.switchMockUser(BOB.email)
      assert.ok(store.hasIdentity('owner'))
      assert.equal(store.hasIdentity('passenger'), false)
    })
  })
})

describe('M1 登录态 30 天', () => {
  const { SESSION_TTL_MS, isSessionValid, writeSession, clearSession } = require('../../miniprogram/modules/auth/session')

  it('登录后 session 有效', async () => {
    await withAuthStore({}, ({ store, mockWx }) => {
      store.loginWithEmail('session.user@disney.com')
      simulatePassengerOnboarding(store)
      assert.equal(store.isLoggedIn(), true)
      const session = mockWx.getStorageSync('authSession')
      assert.ok(session.expiresAt > Date.now())
      assert.ok(session.expiresAt <= Date.now() + SESSION_TTL_MS + 1000)
    })
  })

  it('超过 30 天 session 失效', async () => {
    await withAuthStore({}, ({ store, mockWx }) => {
      store.loginWithEmail('expired.user@disney.com')
      mockWx.setStorageSync('authSession', {
        email: 'expired.user@disney.com',
        expiresAt: Date.now() - 1000
      })
      store.initFromStorage()
      assert.equal(isSessionValid(), false)
      assert.equal(store.isLoggedIn(), false)
    })
  })

  it('logout 清除 session', async () => {
    await withAuthStore({}, ({ store, mockWx }) => {
      store.loginWithEmail('logout.user@disney.com')
      store.logout()
      assert.equal(mockWx.getStorageSync('authSession'), '')
      assert.equal(store.isLoggedIn(), false)
    })
  })
})

describe('M1 身份与页面准入（P0 无车主发单）', () => {
  it('纯乘客身份：hasIdentity(owner)=false', async () => {
    await withAuthStore({}, ({ store }) => {
      store.loginWithEmail('p.only@disney.com')
      simulatePassengerOnboarding(store)
      assert.equal(store.hasIdentity('owner'), false)
      assert.equal(store.hasIdentity('passenger'), true)
    })
  })

  it('纯车主身份：可接单，发布页需乘客身份', async () => {
    await withAuthStore({}, ({ store }) => {
      store.loginWithEmail('d.only@disney.com')
      simulateOwnerOnboarding(store)
      assert.equal(store.hasIdentity('owner'), true)
      assert.equal(store.hasIdentity('passenger'), false)
      assert.equal(store.getMissingIdentity(), 'passenger')
    })
  })
})

describe('M1 历史列表合并（登录后 initFromStorage）', () => {
  it('乘客登录后发单后 historyPassenger 含 M3 真实单', async () => {
    await withOrderModule(null, async ({ order, mockWx }) => {
      await withAuthStore(
        { loggedIn: true, userInfo: { email: ALICE.email, displayName: 'Alice' } },
        async ({ store }) => {
          store.loginWithEmail(ALICE.email)
          simulatePassengerOnboarding(store)
          await order.createOrder(require('../helpers/setup').buildCreateInput())

          store.initFromStorage()
          const passengerHistory = store.getState().historyPassenger
          assert.ok(passengerHistory.some((item) => item.m3OrderId))
          assert.equal(passengerHistory.some((item) => item.id === 'p-matching'), false)
        }
      )
    })
  })
})
