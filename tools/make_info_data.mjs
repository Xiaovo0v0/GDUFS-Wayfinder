// 生成建筑信息卡数据：把官方档案（教学/生活区）+ 体块数据合并，按建筑 id 索引
import fs from 'node:fs';

const ROOT = 'C:/Users/86134/Desktop/gdufs';
const s = fs.readFileSync(`${ROOT}/gdufs-3d/gdufs-data.js`, 'utf8');
const D = JSON.parse(s.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, ''));

const teach = JSON.parse(fs.readFileSync(`${ROOT}/data/official/buildings_teaching.json`, 'utf8'));
const life = JSON.parse(fs.readFileSync(`${ROOT}/data/official/life_area.json`, 'utf8'));
const miscPath = `${ROOT}/data/official/misc_facilities.json`;
const misc = fs.existsSync(miscPath) ? JSON.parse(fs.readFileSync(miscPath, 'utf8')) : [];

const norm = (x) => (x || '')
  .replace(/[（(].*?[）)]/g, '')
  .replace(/[栋区座]/g, '')
  .replace(/大学城校区|教工活动中心|羽毛球场馆|教学/g, '')
  .replace(/\s/g, '');

const official = [...teach, ...life, ...misc];
const byNorm = new Map();
for (const o of official) {
  const keys = [o.name, ...(o.aliases || [])].map(norm).filter(Boolean);
  for (const k of keys) {
    if (!byNorm.has(k)) byNorm.set(k, o);
  }
}

const TYPE_LABEL = {
  academic: '教学 / 办公', dormitory: '学生宿舍', library: '图书馆', canteen: '食堂',
  sports: '体育场馆', culture: '文化 / 会堂', clinic: '医疗', other: '其他',
};

const out = {};
let hit = 0;

// 子建筑（八角楼等）不在 gdufs-data.js 里，由 subplaces.js 在运行时追加，
// 生成信息卡时要把它们一并算进来，否则点开卡片是空的
const subPath = `${ROOT}/gdufs-3d/subplaces.js`;
let subs = [];
if (fs.existsSync(subPath)) {
  const raw = fs.readFileSync(subPath, 'utf8');
  const m = raw.match(/window\.GDUFS_SUBPLACES\s*=\s*(\[[\s\S]*?\]);/);
  if (m) { try { subs = JSON.parse(m[1]); } catch (e) { console.warn('subplaces 解析失败', e.message); } }
}

for (const b of [...D.buildings, ...subs]) {
  const key = norm(b.name);
  const o = byNorm.get(key);
  if (o) hit++;
  const func = o && typeof o.function === 'string' ? o.function : '';
  out[b.id] = {
    name: b.name || '未命名建筑',
    type: TYPE_LABEL[b.type] || b.type,
    levels: b.levels,
    height: b.height,
    area: Math.round(b.area),
    floors: o && o.floors ? String(o.floors) : '',
    built: o && o.built_year ? String(o.built_year) : '',
    func: func.length > 150 ? func.slice(0, 150) + '…' : func,
    hours: o && o.opening_hours ? String(o.opening_hours) : '',
    loc: o && o.location_hint ? String(o.location_hint) : '',
    src: o && o.sources && o.sources.length ? o.sources[0] : '',
    conf: o && o.confidence ? o.confidence : '',
  };
}

const js = 'window.GDUFS_INFO = ' + JSON.stringify(out) + ';\n';
fs.writeFileSync(`${ROOT}/gdufs-3d/info-data.js`, js, 'utf8');
console.log('buildings', D.buildings.length, 'matched official', hit, 'bytes', js.length);
