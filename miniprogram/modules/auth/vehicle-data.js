const COMMON_BRANDS = ['特斯拉', '理想', '奔驰'];

const BRAND_GROUPS = [
  { letter: 'A', brands: ['奥迪', '埃安', '阿维塔', '阿尔法·罗密欧'] },
  { letter: 'B', brands: ['宝马', '奔驰', '比亚迪', '别克', '北京', '宝骏', '奔腾'] },
  { letter: 'C', brands: ['长安', '长城', '传祺'] },
  { letter: 'D', brands: ['大众', '东风'] },
  { letter: 'F', brands: ['福特', '飞凡'] },
  { letter: 'G', brands: ['高合'] },
  { letter: 'H', brands: ['红旗', '哈弗', '本田'] },
  { letter: 'J', brands: ['吉利', 'Jeep', '江淮', '极氪', '极狐'] },
  { letter: 'K', brands: ['凯迪拉克'] },
  { letter: 'L', brands: ['理想', '林肯', '雷克萨斯', '路虎', '领克', '岚图'] },
  { letter: 'M', brands: ['马自达', '名爵', 'Mini'] },
  { letter: 'N', brands: ['哪吒'] },
  { letter: 'O', brands: ['欧拉'] },
  { letter: 'P', brands: ['保时捷'] },
  { letter: 'Q', brands: ['奇瑞', '起亚', '启辰'] },
  { letter: 'R', brands: ['日产'] },
  { letter: 'S', brands: ['三菱', 'Smart'] },
  { letter: 'T', brands: ['特斯拉', '丰田', '坦克', '腾势'] },
  { letter: 'W', brands: ['五菱', '蔚来', '沃尔沃'] },
  { letter: 'X', brands: ['现代', '小鹏', '雪佛兰', '雪铁龙'] },
  { letter: 'Y', brands: ['英菲尼迪'] },
  { letter: 'Z', brands: ['智己'] }
];

const COMMON_PLATE_PREFIXES = ['沪', '苏'];

const PLATE_PREFIX_GROUPS = [
  { letter: 'B', items: ['京'] },
  { letter: 'C', items: ['渝'] },
  { letter: 'G', items: ['粤', '桂', '贵', '甘'] },
  { letter: 'H', items: ['沪', '湘', '鄂', '豫', '黑'] },
  { letter: 'J', items: ['冀', '吉', '苏', '赣'] },
  { letter: 'L', items: ['辽'] },
  { letter: 'N', items: ['闽', '宁'] },
  { letter: 'Q', items: ['青', '琼'] },
  { letter: 'S', items: ['陕', '鲁', '晋'] },
  { letter: 'T', items: ['津'] },
  { letter: 'X', items: ['新', '藏'] },
  { letter: 'Y', items: ['云', '浙'] },
  { letter: 'Z', items: ['皖', '川'] }
];

/** @deprecated 兼容旧引用 */
const COMMON_PROVINCES = COMMON_PLATE_PREFIXES;
const PROVINCE_GROUPS = PLATE_PREFIX_GROUPS;

const INDEX_LETTERS = BRAND_GROUPS.map((g) => g.letter);

const VEHICLE_COLORS = ['白色', '黑色', '银色', '灰色', '红色', '蓝色', '金色', '其他'];

const HABIT_TAG_POOL = [
  '常走西门',
  '常走北门',
  '常早班',
  '常晚班',
  'Base PAB',
  'Base TD',
  '常开空调'
];

const PREFERENCE_NOTE_TAGS = ['携带大件行李', '需要安静'];

const PLATE_REGULAR = /^[A-HJ-NP-Z][A-HJ-NP-Z0-9]{5}$/;
const PLATE_NEW_ENERGY = /^[A-HJ-NP-Z][A-HJ-NP-Z0-9]{6}$/;

function validatePlateSuffix(suffix) {
  const val = (suffix || '').trim().toUpperCase();
  if (!val) {
    return { ok: false, message: '请输入车牌后段' };
  }
  if (PLATE_REGULAR.test(val) || PLATE_NEW_ENERGY.test(val)) {
    return { ok: true, suffix: val };
  }
  return { ok: false, message: '车牌格式不正确（普通7位或新能源8位）' };
}

function formatPreferenceSummary(preference) {
  if (!preference) return '';
  const parts = [...(preference.noteTags || [])];
  if (preference.note && preference.note.trim()) {
    parts.push(preference.note.trim());
  }
  return parts.join(' · ') || '无备注';
}

/** 发布搭车单时，将常用特殊要求与补充说明合并为备注默认值 */
function buildOrderNoteFromPreference(preference) {
  if (!preference) return '';
  const parts = [...(preference.noteTags || [])];
  if (preference.note && preference.note.trim()) {
    parts.push(preference.note.trim());
  }
  return parts.join(' · ');
}

module.exports = {
  COMMON_BRANDS,
  BRAND_GROUPS,
  INDEX_LETTERS,
  COMMON_PLATE_PREFIXES,
  PLATE_PREFIX_GROUPS,
  COMMON_PROVINCES,
  PROVINCE_GROUPS,
  VEHICLE_COLORS,
  HABIT_TAG_POOL,
  PREFERENCE_NOTE_TAGS,
  validatePlateSuffix,
  formatPreferenceSummary,
  buildOrderNoteFromPreference
};
