// 生成 Dify 知识库语料（Q&A 格式）
// 输入: data/service_guide/service_items_lite.json, data/official/buildings_teaching.json, data/official/life_area.json
// 输出: data/dify/service_guide_qa.md, data/dify/campus_wiki_qa.md
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'C:/Users/86134/Desktop/gdufs';
const OUT = path.join(ROOT, 'data/dify');
fs.mkdirSync(OUT, { recursive: true });

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// ---------------- 1. 办事指南 ----------------
const items = readJson(path.join(ROOT, 'data/service_guide/service_items_lite.json'));
const qaBlocks = [];
for (const it of items) {
  const q = `${it.title}怎么办理？在哪里办？需要什么材料？`;
  const lines = [];
  lines.push(`办理部门：${it.department || '未查到'}`);
  lines.push(`办理地点：${it.location || '未查到'}`);
  lines.push(`办理时间：${it.hours || '未查到'}`);
  if (it.materials && it.materials.length) lines.push(`所需材料：${it.materials.join('；')}`);
  if (it.steps && it.steps.length) lines.push(`办理流程：${it.steps.join(' → ')}`);
  if (it.online_url) lines.push(`线上入口：${it.online_url}`);
  if (it.phone) lines.push(`咨询电话：${it.phone}`);
  if (it.sources && it.sources.length) lines.push(`来源：${it.sources[0]}`);
  qaBlocks.push(`Q: ${q}\nA: ${lines.join('\n')}`);
}
const serviceMd = qaBlocks.join('\n\n');
fs.writeFileSync(path.join(OUT, 'service_guide_qa.md'), serviceMd, 'utf8');
console.log('service_guide_qa.md', items.length, 'blocks', serviceMd.length, 'chars');

// ---------------- 2. 校园百科 ----------------
const teach = readJson(path.join(ROOT, 'data/official/buildings_teaching.json'));
const life = readJson(path.join(ROOT, 'data/official/life_area.json'));

const wiki = [];
const push = (q, a) => wiki.push(`Q: ${q}\nA: ${a}`);

for (const b of teach) {
  const q = `${b.name}在哪？是做什么的？有几层？`;
  const lines = [];
  if (b.aliases && b.aliases.length) lines.push(`别名：${b.aliases.join('、')}`);
  if (b.function) lines.push(`功能：${b.function}`);
  if (b.floors) lines.push(`层数：${b.floors}`);
  if (b.built_year) lines.push(`建成年份：${b.built_year}`);
  if (b.appearance) lines.push(`外观：${b.appearance}`);
  if (b.location_hint) lines.push(`位置：${b.location_hint}`);
  if (b.sources && b.sources.length) lines.push(`来源：${b.sources[0]}`);
  push(q, lines.join('\n'));
}

for (const l of life) {
  const q = `${l.name}在哪？开放时间是什么？`;
  const lines = [];
  if (l.category) lines.push(`类别：${l.category}`);
  if (l.function) lines.push(`功能：${l.function}`);
  if (l.floors) lines.push(`层数：${l.floors}`);
  if (l.appearance) lines.push(`外观：${l.appearance}`);
  if (l.location_hint) lines.push(`位置：${l.location_hint}`);
  if (l.opening_hours) lines.push(`开放时间：${l.opening_hours}`);
  if (l.aliases && l.aliases.length) lines.push(`别名：${l.aliases.join('、')}`);
  if (l.sources && l.sources.length) lines.push(`来源：${l.sources[0]}`);
  push(q, lines.join('\n'));
}

// 额外：校门清单与校区常识
push('广外大学城校区一共有几个校门？分别叫什么？',
  '官方平面图只标注 6 个出入口：正门（东北角，朝外环东路）、行政出入口（东南侧，朝外环东路）、1号门（中环路，文采园与地下隧道之间，通往北苑宿舍区）、2号门（外环东路南段近中环路，友苑南侧，通往宿舍区）、3号门（西侧外环西路，学生活动中心旁）、4号门（西南角内环东路，风采园旁、南苑13栋侧）。官方从不使用"东门/南门/西门"这类称谓。来源：https://yx.gdufs.edu.cn/n.jpg');
push('教学区和生活区怎么通行？',
  '教学区与生活区被中环路分隔，唯一的地面通道是地下隧道：下沉式广场 → 地下隧道 → 下沉式广场，隧道上方就是中环路。步行导航经过隧道时距离约 820 米（文采园到图书馆）。');
push('广外大学城校区在哪里？',
  '广东外语外贸大学大学城校区（南校区）位于广州市番禺区小谷围街道大学城外环东路 178 号，邮编 510006，中心坐标约 23.0666°N、113.3929°E。');

const wikiMd = wiki.join('\n\n');
fs.writeFileSync(path.join(OUT, 'campus_wiki_qa.md'), wikiMd, 'utf8');
console.log('campus_wiki_qa.md', wiki.length, 'blocks', wikiMd.length, 'chars');
