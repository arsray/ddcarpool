/**
 * M4 — 聊天消息展示层（微信气泡布局 + 钉钉已读样式）
 */

const DEFAULT_AVATAR_COLORS = {
  passenger: '#0089FF',
  driver: '#00B578'
}

function avatarLetter(name) {
  const text = String(name || 'U').trim()
  return text ? text.charAt(0).toUpperCase() : 'U'
}

function buildParticipantProfile(name, avatarUrl, role) {
  const roleFallback = role === 'driver' ? '司机' : '乘客'
  let displayName = String(name || '').trim()
  if (!displayName || displayName === '用户') {
    displayName = roleFallback
  }
  return {
    name: displayName,
    avatarUrl: avatarUrl || '',
    avatarLetter: avatarLetter(displayName),
    avatarColor: DEFAULT_AVATAR_COLORS[role] || '#8a94a6'
  }
}

function resolveParticipants(participants, myRole) {
  const passenger = buildParticipantProfile(
    (participants && participants.passenger && participants.passenger.name) || '乘客',
    participants && participants.passenger ? participants.passenger.avatarUrl : '',
    'passenger'
  )
  const driver = buildParticipantProfile(
    (participants && participants.driver && participants.driver.name) || '司机',
    participants && participants.driver ? participants.driver.avatarUrl : '',
    'driver'
  )
  const selfRole = myRole === 'driver' ? 'driver' : 'passenger'
  const peerRole = selfRole === 'driver' ? 'passenger' : 'driver'
  return {
    self: selfRole === 'driver' ? driver : passenger,
    peer: peerRole === 'driver' ? driver : passenger
  }
}

function presentMessage(item, view) {
  if (item.isSystem || item.type === 'system') {
    return {
      ...item,
      isSystem: true,
      showReadStatus: false,
      readLabel: '',
      readStatusClass: ''
    }
  }

  const isMine = Boolean(item.isMine)
  const avatar = isMine ? view.self : view.peer
  const readLabel = isMine ? (item.isRead ? '已读' : '未读') : ''
  return {
    ...item,
    avatarUrl: avatar.avatarUrl || item.senderAvatarUrl,
    avatarLetter: avatar.avatarLetter,
    avatarColor: avatar.avatarColor,
    showReadStatus: isMine,
    readLabel,
    readStatusClass: item.isRead ? 'chat-read--read' : 'chat-read--unread'
  }
}

function presentMessages(messages, participants, myRole) {
  const view = resolveParticipants(participants, myRole)
  return (messages || []).map((item) => presentMessage(item, view))
}

module.exports = {
  avatarLetter,
  resolveParticipants,
  presentMessage,
  presentMessages
}
