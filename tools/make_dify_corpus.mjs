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

// 额外：三校区地址（依据学校章程）
push('广东外语外贸大学有几个校区？分别在哪里？',
  '三个校区：白云山校区（北校区）在广州市白云区白云大道北 2 号；大学城校区（南校区）在广州市番禺区广州大学城外环东路 178 号；大朗校区在广州市白云区广花一路 599 号。学校法定住所为白云大道北 2 号。来源：广东外语外贸大学章程 https://www.gdufs.edu.cn/AboutGDUFS/xxzc.htm');
push('南校区和北校区怎么区分？',
  '北校区即白云山校区，在白云区白云大道北 2 号，紧邻白云山，以语言类学院为主；南校区即大学城校区，在番禺区大学城外环东路 178 号，以小谷围岛上的大学城为主体，以经管法理工类学院为主。两个校区之间没有校内通道，需乘坐公共交通或校车往返。学院分布来源：https://www.gdufs.edu.cn/AboutGDUFS/xxzc.htm');

// 额外：北校区地标与布局
push('相思河在哪？',
  '相思河是白云山校区（北校区）校园内的水系景观，自北向南穿过校园中部，两岸为步道与绿化带，是校园文化景观之一（学校新闻网设有「文化景观行」专栏《相思河畔诉"相思"》）。在南校区地图上没有这条河，问「相思河」指的是北校区。来源：学校《北校区平面图》水系图层；https://news.gdufs.edu.cn/info/1067/24192.htm');
push('北校区（白云山校区）有几个校门？',
  '学校《北校区平面图》上标注 3 个出入口：北门（校园北侧）、正门（校园东南侧）、南门（校园南侧），「尚行」3D 地图只标注这 3 个。此外校车乘车点里还提到东门、白云山西门站，属于校园外围通道与站点，不在平面图的门禁标注里。南校区是另一套编号体系（正门 / 行政出入口 / 1–4 号门，共 6 个），两个校区的校门不通用。');
push('北校区（白云山校区）的布局是怎样的？',
  '北校区以相思河为轴：河东侧是教学区（第二、三、四、六、七教学楼、图书馆、BBA 教育中心、行政楼），河西侧与北侧是生活区（云山一栋至十九栋宿舍、第一/第二学生食堂、干训楼、逸林酒店），云山会堂与学生服务大厅在校园中部。北门在北侧、正门在东南侧、南门在南侧。');

// ---------------- 3. 其他设施（八角楼等） ----------------
const miscPath = path.join(ROOT, 'data/official/misc_facilities.json');
if (fs.existsSync(miscPath)) {
  const misc = readJson(miscPath);
  for (const m of misc) {
    const q = `${m.name}在哪？是做什么用的？怎么预约？`;
    const lines = [];
    if (m.category) lines.push(`类别：${m.category}`);
    if (m.function) lines.push(`功能：${m.function}`);
    if (m.floors) lines.push(`层数：${m.floors}`);
    if (m.appearance) lines.push(`外观：${m.appearance}`);
    if (m.location_hint) lines.push(`位置：${m.location_hint}`);
    if (m.opening_hours) lines.push(`开放时间：${m.opening_hours}`);
    if (m.phone) lines.push(`联系电话：${m.phone}`);
    if (m.sources && m.sources.length) lines.push(`来源：${m.sources[0]}`);
    push(q, lines.join('\n'));
  }
  console.log('misc 条目', misc.length);
}

// ---------------- 4. 北校区（白云山校区）楼栋 ----------------
const northPath = path.join(ROOT, 'data/official/north_buildings.json');
if (fs.existsSync(northPath)) {
  const nb = readJson(northPath).buildings || [];
  const TYPE_CN = {
    teaching: '教学', dorm: '学生宿舍', canteen: '食堂', sports: '体育场馆',
    culture: '文化 / 会堂', office: '办公', hotel: '酒店', clinic: '门诊',
    library: '图书馆', misc: '其他',
  };
  let n = 0;
  for (const b of nb) {
    if (!b.name || b.name_confidence === 'unknown') continue;
    const q = `北校区（白云山校区）的${b.name}在哪？有几层？`;
    const lines = [];
    lines.push('校区：白云山校区（北校区）');
    lines.push(`类别：${TYPE_CN[b.type] || '其他'}`);
    if (b.levels) lines.push(`层数：${b.levels} 层（按建筑类型推定）`);
    if (b.height) lines.push(`高度：约 ${b.height.toFixed(1)} m（推定）`);
    if (b.area) lines.push(`基底面积：约 ${Math.round(b.area)} ㎡`);
    lines.push('位置：北校区平面图见 https://yx.gdufs.edu.cn/ ，可在「尚行」3D 地图切换到北校区查看楼栋位置');
    lines.push('数据来源：学校《北校区平面图》矢量化，比例尺以 400 m 田径场长轴标定');
    push(q, lines.join('\n'));
    n++;
  }
  console.log('北校楼栋条目', n);
}



const wikiMd = wiki.join('\n\n');
fs.writeFileSync(path.join(OUT, 'campus_wiki_qa.md'), wikiMd, 'utf8');
console.log('campus_wiki_qa.md', wiki.length, 'blocks', wikiMd.length, 'chars');
