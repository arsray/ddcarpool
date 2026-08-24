/**
 * Mock 测试账号预设 — 仅本地预览阶段使用
 */

const MOCK_TEST_USERS = [
  {
    id: 'passenger',
    label: '乘客 Alice',
    subtitle: '仅乘车人 · 用于发单',
    email: 'alice.passenger@disney.com',
    userInfo: {
      email: 'alice.passenger@disney.com',
      displayName: 'Alice',
      phone: '',
      department: ''
    },
    identities: ['passenger'],
    userMode: 'passenger',
    onboardingComplete: true,
    vehicle: null,
    preference: {
      defaultCount: 1,
      noteTags: ['携带大件行李'],
      note: ''
    },
    habitTags: []
  },
  {
    id: 'driver',
    label: '司机 Bob',
    subtitle: '仅车主 · 用于广场接单',
    email: 'bob.driver@disney.com',
    userInfo: {
      email: 'bob.driver@disney.com',
      displayName: 'Bob',
      phone: '',
      department: ''
    },
    identities: ['owner'],
    userMode: 'owner',
    onboardingComplete: true,
    vehicle: {
      brand: '特斯拉',
      modelType: 'SUV',
      plate: '沪A12345',
      passengerCapacity: 4,
      color: '白色'
    },
    preference: null,
    habitTags: ['常走西门']
  }
]

const SNAPSHOT_STORAGE_KEY = 'mockUserSnapshots'

function getMockTestUsers() {
  return MOCK_TEST_USERS.map((user) => ({ ...user }))
}

function findMockTestUser(email) {
  const normalized = (email || '').trim().toLowerCase()
  return MOCK_TEST_USERS.find((user) => user.email === normalized) || null
}

function presetToSnapshot(preset) {
  return {
    userInfo: { ...preset.userInfo },
    identities: preset.identities.slice(),
    onboardingComplete: preset.onboardingComplete,
    userMode: preset.userMode,
    vehicle: preset.vehicle ? { ...preset.vehicle } : null,
    preference: preset.preference ? { ...preset.preference, noteTags: (preset.preference.noteTags || []).slice() } : null,
    habitTags: (preset.habitTags || []).slice(),
    notifications: []
  }
}

module.exports = {
  SNAPSHOT_STORAGE_KEY,
  getMockTestUsers,
  findMockTestUser,
  presetToSnapshot
}
