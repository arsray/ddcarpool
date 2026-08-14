const { normalizeEmail } = require('./email');

const COOLDOWN_MS = 60 * 1000;
const EXPIRE_MS = 10 * 60 * 1000;
const CODE_LEN = 6;

function storageKey(email) {
  return `verify_${normalizeEmail(email)}`;
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sendCode(email) {
  const normalized = normalizeEmail(email);
  const key = storageKey(normalized);
  const now = Date.now();
  const existing = wx.getStorageSync(key);

  if (existing && existing.sentAt && now - existing.sentAt < COOLDOWN_MS) {
    const remain = Math.ceil((COOLDOWN_MS - (now - existing.sentAt)) / 1000);
    return { ok: false, code: 'cooldown', remain, message: `${remain}s 后可重新获取` };
  }

  const code = generateCode();
  wx.setStorageSync(key, {
    email: normalized,
    code,
    sentAt: now,
    expiresAt: now + EXPIRE_MS
  });

  return { ok: true, code, message: '验证码已发送至您的邮箱，请查收' };
}

function getCooldownRemain(email) {
  const existing = wx.getStorageSync(storageKey(email));
  if (!existing || !existing.sentAt) return 0;
  const remain = COOLDOWN_MS - (Date.now() - existing.sentAt);
  return remain > 0 ? Math.ceil(remain / 1000) : 0;
}

function hasSentCode(email) {
  const existing = wx.getStorageSync(storageKey(email));
  if (!existing || !existing.sentAt) return false;
  return Date.now() < existing.expiresAt;
}

function verifyCode(email, input) {
  const normalized = normalizeEmail(email);
  const key = storageKey(normalized);
  const record = wx.getStorageSync(key);

  if (!record || !record.sentAt) {
    return { ok: false, message: '请先获取验证码' };
  }
  if (Date.now() > record.expiresAt) {
    wx.removeStorageSync(key);
    return { ok: false, message: '验证码错误或已过期，请重新获取' };
  }
  if (!input || !/^\d{6}$/.test(input)) {
    return { ok: false, message: '请输入 6 位数字验证码' };
  }
  if (input !== record.code) {
    return { ok: false, message: '验证码错误或已过期，请重新获取' };
  }

  wx.removeStorageSync(key);
  return { ok: true, email: normalized };
}

module.exports = {
  COOLDOWN_MS,
  EXPIRE_MS,
  CODE_LEN,
  sendCode,
  verifyCode,
  getCooldownRemain,
  hasSentCode
};
