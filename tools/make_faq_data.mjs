// 生成前端离线兜底用的精简 FAQ 数据（Dify 不可达时使用）
import fs from 'node:fs';

const items = JSON.parse(fs.readFileSync('C:/Users/86134/Desktop/gdufs/data/service_guide/service_items_lite.json', 'utf8'));
const compact = items.map((it) => ({
  t: it.title,
  d: it.department || '',
  l: it.location || '',
  h: it.hours || '',
  m: (it.materials || []).join('；').slice(0, 220),
  s: (it.steps || []).join(' → ').slice(0, 320),
  u: it.online_url || '',
  p: it.phone || '',
  src: (it.sources || [])[0] || '',
}));

const out = 'window.GDUFS_FAQ = ' + JSON.stringify(compact) + ';\n';
fs.writeFileSync('C:/Users/86134/Desktop/gdufs/gdufs-3d/faq-data.js', out, 'utf8');
console.log('faq items', compact.length, 'bytes', out.length);
