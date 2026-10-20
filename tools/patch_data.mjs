// 依据官方资料修正 gdufs-data.js 的建筑名称/层数/高度与校门名称。
// 来源：data/official/buildings_teaching.json（规划验收合格证）、life_area.json（官方平面图/后勤饮食服务）
import fs from 'node:fs';

const FILE = 'C:/Users/86134/Desktop/gdufs/gdufs-3d/gdufs-data.js';
const raw = fs.readFileSync(FILE, 'utf8');
const json = raw.replace(/^window\.GDUFS_DATA\s*=\s*/, '').replace(/;\s*$/, '');
const D = JSON.parse(json);

// id -> { name, levels, height }
const OVERRIDE = {
  B001: { name: '大会堂（教工活动中心）', levels: 2, height: 13 },      // 规划验收：连体，地上2层(部分1层) 8375㎡
  B002: { name: '图书馆', levels: 6, height: 27 },                     // 地上6层 25526㎡
  B003: { name: '院系办公楼', levels: 4, height: 17 },                  // 地上4层 12292㎡
  B004: { name: '行政办公楼', levels: 5, height: 20 },                  // 规范名；层数未查到，暂按5层
  B032: { name: '艺术楼', levels: 5, height: 21 },                      // 地上5层(部分3层) 13272㎡
  B041: { name: '学术交流中心', levels: 6, height: 23 },                // 地上6层 13007㎡
  B031: { name: '体育馆（羽毛球馆）', levels: 3, height: 24 },           // 地上3层(部分2层) 10670㎡
  B030: { name: '体育场看台', levels: 2, height: 16 },
  B025: { name: '文采园（第一饭堂）', levels: 2, height: 11 },           // 1F 1736 座 + 2F 1250 座
  B020: { name: '博雅园（第二饭堂）', levels: 2, height: 11 },           // 500 + 500 座
  B027: { name: '风采园（第三饭堂）', levels: 3, height: 14 },           // 700 + 500 座，有三楼
  B024: { name: '门诊部（校医院）', levels: 3, height: 12 },
  B028: { name: '师苑（C16/C18）', levels: 7, height: 22 },
};

const RENAME = {
  '7栋': '南苑7栋', '8栋': '南苑8栋', '9栋': '南苑9栋', '10栋': '南苑10栋',
  '11栋': '南苑11栋', '12栋': '南苑12栋', '13栋': '南苑13栋',
  '校办公楼': '行政办公楼', '大学城校区图书馆': '图书馆', '大学城校区门诊部': '门诊部（校医院）',
};

let changed = 0;
for (const b of D.buildings) {
  const ov = OVERRIDE[b.id];
  if (ov) {
    if (ov.name) b.name = ov.name;
    if (ov.levels) b.levels = ov.levels;
    if (ov.height) b.height = ov.height;
    changed++;
  } else if (RENAME[b.name]) {
    b.name = RENAME[b.name];
    changed++;
  }
  // 连体块拆分后的名称保持
}

// 校门：官方平面图只有 6 个出入口（正门 / 行政出入口 / 1号门 / 2号门 / 3号门 / 4号门）
const GATE_RENAME = {
  '主校门（正门）': '正门',
  '行政出入口（北）': '行政出入口',
  '行政出入口（南）': '',
  '西南门': '1号门（中环路·隧道旁）',
  '生活区4号门': '3号门（外环西路·学生活动中心旁）',
  '北门': '',
  '西北门': '',
};
for (const g of D.gates) {
  if (Object.prototype.hasOwnProperty.call(GATE_RENAME, g.name)) {
    g.name = GATE_RENAME[g.name];
    g.name_confidence = g.name ? 'official' : 'unnamed';
    changed++;
  }
}

D.meta.corrections = {
  date: '2026-10-18',
  note: '依据广外官方资料与广州市规划验收合格证修正名称/层数/高度；校门按官方平面图 6 个出入口命名，2号门与4号门位置待用官方平面图配准后补齐。',
  sources: [
    'https://yx.gdufs.edu.cn/n.jpg (官方平面图，6 个出入口)',
    'https://hqc.gdufs.edu.cn/info/1002/1444.htm (饮食服务：食堂座位数与营业时间)',
    '广州市规划和自然资源局 建设工程规划验收合格证（图书馆/会堂/艺术楼/院系办公楼/学术交流中心/体育馆/体育场）',
  ],
};

// 同步导航点名称（places 的 label 是生成时拷贝的，需跟着建筑/校门改名）
const bmap = new Map(D.buildings.map((b) => [b.id, b]));
const gmap = new Map();
for (const g of D.gates) {
  const key = g.x.toFixed(1) + ',' + g.z.toFixed(1);
  gmap.set(key, g);
}
for (const p of D.places) {
  if (p.kind === 'building') {
    const b = bmap.get(p.ref);
    if (b && b.name) p.label = b.name;
  } else if (p.kind === 'gate') {
    const key = p.x.toFixed(1) + ',' + p.z.toFixed(1);
    const g = gmap.get(key);
    if (g) p.label = g.name || '出入口（未命名）';
  }
}
D.places = D.places.filter((p) => p.label && p.label !== '出入口（未命名）');

fs.writeFileSync(FILE, 'window.GDUFS_DATA = ' + JSON.stringify(D) + ';\n', 'utf8');
console.log('changed', changed, 'buildings', D.buildings.length, 'gates', D.gates.length);
