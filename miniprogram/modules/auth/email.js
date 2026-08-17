const DISNEY_SUFFIX = '@disney.com'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
/** 邮箱 @ 前本地段：字母数字开头结尾，中间可含 . _ - */
const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/

function normalizeEmail(email) {
  return (email || '').trim().toLowerCase()
}

function normalizeLocalPart(raw) {
  let val = normalizeEmail(raw)
  if (val.includes('@')) {
    val = val.split('@')[0]
  }
  return val.replace(/@disney\.com/gi, '')
}

function buildDisneyEmail(localPart) {
  const local = normalizeLocalPart(localPart)
  if (!local) return ''
  return `${local}${DISNEY_SUFFIX}`
}

function validateEmailPrefix(raw) {
  const localPart = normalizeLocalPart(raw)
  if (!localPart) {
    return { ok: false, code: 'empty', message: '请输入邮箱前缀' }
  }
  if ((raw || '').includes('@') && !(raw || '').toLowerCase().endsWith(DISNEY_SUFFIX)) {
    return { ok: false, code: 'suffix', message: '仅支持 @disney.com 公司邮箱' }
  }
  if (!LOCAL_PART_RE.test(localPart)) {
    return {
      ok: false,
      code: 'format',
      message: '前缀仅支持字母、数字、点、横线、下划线，且不能以符号开头或结尾'
    }
  }
  if (localPart.includes('..')) {
    return { ok: false, code: 'format', message: '前缀格式不正确' }
  }
  const email = buildDisneyEmail(localPart)
  if (!EMAIL_RE.test(email) || !email.endsWith(DISNEY_SUFFIX)) {
    return { ok: false, code: 'format', message: '请输入有效的邮箱前缀' }
  }
  return { ok: true, email, localPart }
}

function validateEmail(raw) {
  const email = normalizeEmail(raw)
  if (!email) {
    return { ok: false, code: 'empty', message: '请输入公司邮箱' }
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, code: 'format', message: '请输入 @disney.com 结尾的有效邮箱' }
  }
  if (!email.endsWith(DISNEY_SUFFIX)) {
    return { ok: false, code: 'suffix', message: '仅支持 @disney.com 公司邮箱' }
  }
  return { ok: true, email }
}

module.exports = {
  DISNEY_SUFFIX,
  normalizeEmail,
  normalizeLocalPart,
  buildDisneyEmail,
  validateEmailPrefix,
  validateEmail
}
