// 生成 4 个"技能工作流"的 Dify DSL（可直接导入开放平台）
//   node tools/make_skill_dsl.mjs
// 产出：skills/dsl/{route-calc,place-lookup,office-hours,materials-check}.yml
//
// 设计：每个技能都是一个独立 workflow（start → code → end），
// 导入 Dify 后"发布为工具"，即可被主应用以工具节点/Agent 方式调用。

import fs from 'node:fs';
import path from 'node:path';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const OUT = path.join(REPO, 'skills/dsl');

// ---------- 读取数据 ----------
const dataJs = fs.readFileSync(path.join(REPO, 'gdufs-3d/gdufs-data.js'), 'utf8');
const DATA = JSON.parse(dataJs.slice(dataJs.indexOf('{'), dataJs.lastIndexOf(';')));

const svcJs = fs.readFileSync(path.join(REPO, 'gdufs-3d/service-data.js'), 'utf8');
const SERVICE = JSON.parse(svcJs.slice(svcJs.indexOf('['), svcJs.lastIndexOf(';')));

// 精简路网：只留坐标、边、地名→节点
const graph = {
  n: DATA.graph.nodes.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]),
  e: DATA.graph.edges.map((e) => [e.a, e.b, Math.round(e.len * 10) / 10]),
  p: {},
};
for (const pl of DATA.places || []) {
  if (pl.node != null && pl.label) graph.p[pl.label] = pl.node;
}

const places = (DATA.places || []).map((p) => ({
  label: p.label,
  x: Math.round(p.x * 10) / 10,
  z: Math.round(p.z * 10) / 10,
  kind: p.kind || 'building',
  node: p.node,
}));

const services = SERVICE.map((s) => ({
  sid: s.sid,
  title: s.title,
  dept: s.dept,
  hours: s.hours,
  materials: s.materials,
  phone: s.phone,
  url: s.url,
  south: s.south,
  north: s.north,
  online: s.online,
}));

// ---------- Python 代码模板 ----------
// Dify 的代码节点要求 main() 返回 dict，所以统一用 _out() 包一层
const OUT_HELPER = `import json

def _out(obj, **kw):
    return {"result": json.dumps(obj, ensure_ascii=False)}
`;

const PY_ROUTE = `
import json, heapq

G = json.loads(r"""__GRAPH__""")

def _find(name):
    name = (name or "").strip()
    if name in G["p"]:
        return G["p"][name]
    for k, v in G["p"].items():
        if name and (name in k or k in name):
            return v
    return None

def _dij(s, t):
    n = len(G["n"])
    INF = 1e18
    dist = [INF] * n
    prev = [-1] * n
    dist[s] = 0.0
    pq = [(0.0, s)]
    adj = [[] for _ in range(n)]
    for a, b, L in G["e"]:
        adj[a].append((b, L))
        adj[b].append((a, L))
    while pq:
        d, u = heapq.heappop(pq)
        if d > dist[u]:
            continue
        if u == t:
            break
        for v, w in adj[u]:
            nd = d + w
            if nd < dist[v]:
                dist[v] = nd
                prev[v] = u
                heapq.heappush(pq, (nd, v))
    if dist[t] >= INF:
        return None, None
    path = []
    cur = t
    while cur != -1:
        path.append(cur)
        cur = prev[cur]
    path.reverse()
    return dist[t], path

def main(from_name: str, to_name: str) -> str:
    s = _find(from_name)
    t = _find(to_name)
    if s is None or t is None:
        return json.dumps({"ok": False, "error": "地点未识别", "from": from_name, "to": to_name}, ensure_ascii=False)
    if s == t:
        return json.dumps({"ok": False, "error": "起终点相同"}, ensure_ascii=False)
    d, path = _dij(s, t)
    if d is None:
        return json.dumps({"ok": False, "error": "路网不连通"}, ensure_ascii=False)
    pts = [[G["n"][i][0], G["n"][i][1]] for i in path]
    return json.dumps({
        "ok": True,
        "from": from_name,
        "to": to_name,
        "distance": round(d, 1),
        "minutes": max(1, round(d / 70.0)),
        "points": pts
    }, ensure_ascii=False)
`.trim();

const PY_PLACE = `
import json, re

PLACES = json.loads(r"""__PLACES__""")

ALIAS = {"一饭": "文采园（第一饭堂）", "二饭": "博雅园（第二饭堂）",
         "校医院": "门诊部（校医院）", "行政楼": "行政办公楼"}

def main(query: str) -> str:
    q = re.sub(r"[\\s·、,，。？?]", "", query or "")
    if not q:
        return json.dumps({"ok": False, "error": "空查询"}, ensure_ascii=False)
    for a, full in ALIAS.items():
        if a in q:
            q = q.replace(a, full)
    cands = []
    for p in PLACES:
        label = p["label"]
        score = 0
        if label in q:
            score = 100 + len(label)
        else:
            core = re.sub(r"[（(].*?[）)]", "", label)
            if core and core in q:
                score = 60 + len(core)
            elif q in label:
                score = 30 + len(q)
        if score:
            cands.append({"label": label, "x": p["x"], "z": p["z"],
                          "kind": p["kind"], "node": p["node"], "score": score})
    cands.sort(key=lambda c: -c["score"])
    if not cands:
        return json.dumps({"ok": False, "error": "未匹配到地点", "query": query}, ensure_ascii=False)
    best = cands[0]
    return json.dumps({"ok": True, "query": query, "label": best["label"],
                       "x": best["x"], "z": best["z"], "kind": best["kind"],
                       "node": best["node"],
                       "alternatives": [c["label"] for c in cands[1:4]]},
                      ensure_ascii=False)
`.trim();

const PY_HOURS = `
import json, re
from datetime import datetime

SERVICES = json.loads(r"""__SERVICE__""")

WD = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0}

def _segments(text, campus):
    segs = [s for s in re.split(r"[；;]", text or "") if s.strip()]
    key = {"north": ["北校区", "北校"], "south": ["南校区", "南校", "大学城"]}.get(campus, [])
    if key:
        hit = [s for s in segs if any(k in s for k in key)]
        if hit:
            return hit
    return segs

def main(item_title: str, campus: str = "south", now: str = "") -> str:
    title = (item_title or "").strip()
    svc = None
    for s in SERVICES:
        if s["title"] and (title in s["title"] or s["title"] in title):
            svc = s
            break
    if svc is None:
        return json.dumps({"ok": False, "error": "未找到该事项"}, ensure_ascii=False)
    text = svc.get("hours") or ""
    segs = _segments(text, campus)
    src = "；".join(segs)
    days = []
    for m in re.finditer(r"周([一二三四五六日天])", src):
        d = WD.get(m.group(1))
        if d is not None and d not in days:
            days.append(d)
    ranges = []
    for m in re.finditer(r"(\\d{1,2})[:：](\\d{2})\\s*[-–~至]\\s*(\\d{1,2})[:：](\\d{2})", src):
        ranges.append([int(m.group(1)) * 60 + int(m.group(2)),
                       int(m.group(3)) * 60 + int(m.group(4))])
    if not ranges:
        return json.dumps({"ok": True, "item": svc["title"], "known": False,
                           "note": "官网未公布具体时段", "raw": text}, ensure_ascii=False)
    dt = datetime.strptime(now, "%Y-%m-%d %H:%M") if now else datetime.now()
    dow = dt.isoweekday() % 7          # python: Mon=0..Sun=6 -> 周日=0
    mins = dt.hour * 60 + dt.minute
    day_ok = (dow in days) if days else True
    open_now = any(a <= mins <= b for a, b in ranges)
    def hhmm(v): return "%02d:%02d" % (v // 60, v % 60)
    return json.dumps({
        "ok": True, "item": svc["title"], "known": True,
        "open": bool(day_ok and open_now),
        "next_open": hhmm(ranges[0][0]), "close_at": hhmm(ranges[-1][1]),
        "days": days, "note": src
    }, ensure_ascii=False)
`.trim();

const PY_MATERIALS = `
import json, re

SERVICES = json.loads(r"""__SERVICE__""")

def main(item_title: str, campus: str = "south") -> str:
    title = (item_title or "").strip()
    svc = None
    for s in SERVICES:
        if s["title"] and (title in s["title"] or s["title"] in title):
            svc = s
            break
    if svc is None:
        return json.dumps({"ok": False, "error": "未找到该事项"}, ensure_ascii=False)
    here = svc.get(campus) or []
    other = svc.get("north" if campus == "south" else "south") or []
    return json.dumps({
        "ok": True,
        "item": svc["title"],
        "department": svc["dept"],
        "materials": svc["materials"],
        "count": len(svc["materials"] or []),
        "phone": svc["phone"],
        "online": svc["online"],
        "places_here": here,
        "places_other": other,
        "url": svc["url"]
    }, ensure_ascii=False)
`.trim();

// ---------- DSL 组装 ----------
let seq = 1700000000000;
const nid = () => String(seq++);

function workflowYaml({ name, desc, icon, bg, startVars, code, outputs, codeTitle }) {
  const START = nid(), CODE = nid(), END = nid();
  const codeLiteral = OUT_HELPER + '\n' + code
    .replace(/return json\.dumps\(/g, 'return _out(')
    .replace(/__GRAPH__/g, JSON.stringify(graph))
    .replace(/__PLACES__/g, JSON.stringify(places))
    .replace(/__SERVICE__/g, JSON.stringify(services));

  const indent = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

  return `app:
  description: '${desc}'
  icon: '${icon}'
  icon_background: '${bg}'
  icon_type: emoji
  mode: workflow
  name: '${name}'
  use_icon_as_answer_icon: false
kind: app
version: 0.7.0
workflow:
  conversation_variables: []
  environment_variables: []
  features:
    file_upload: {}
    retriever_resource:
      enabled: true
    sensitive_word_avoidance:
      enabled: false
    text_to_speech:
      enabled: false
      language: ''
      voice: ''
  graph:
    edges:
${startVars.length >= 0 ? '' : ''}    - data:
        isInIteration: false
        isInLoop: false
        sourceType: start
        targetType: code
      id: ${START}-source-${CODE}-target
      source: '${START}'
      sourceHandle: source
      target: '${CODE}'
      targetHandle: target
      type: custom
      zIndex: 0
    - data:
        isInIteration: false
        isInLoop: false
        sourceType: code
        targetType: end
      id: ${CODE}-source-${END}-target
      source: '${CODE}'
      sourceHandle: source
      target: '${END}'
      targetHandle: target
      type: custom
      zIndex: 0
    nodes:
    - data:
        selected: false
        title: 开始
        type: start
        variables:
${startVars.map((v) => `        - default: ''
          hint: ''
          label: '${v.label}'
          max_length: 256
          options: []
          placeholder: ''
          required: ${v.required}
          type: text-input
          variable: ${v.name}`).join('\n')}
      height: 120
      id: '${START}'
      position:
        x: 120
        y: 300
      positionAbsolute:
        x: 120
        y: 300
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
      zIndex: 0
    - data:
        selected: false
        title: '${codeTitle}'
        type: code
        code_language: python3
        variables:
${startVars.map((v) => `        - value_selector:
          - '${START}'
          - ${v.name}
          variable: ${v.name}`).join('\n')}
        code: |-
${indent(codeLiteral, 10)}
        outputs:
${Object.keys(outputs).map((k) => `          ${k}:
            type: string
            children: null`).join('\n')}
      height: 120
      id: '${CODE}'
      position:
        x: 460
        y: 300
      positionAbsolute:
        x: 460
        y: 300
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
      zIndex: 0
    - data:
        selected: false
        title: 输出
        type: end
        outputs:
${Object.keys(outputs).map((k) => `        - value_selector:
          - '${CODE}'
          - ${k}
          value_type: string
          variable: ${k}`).join('\n')}
      height: 108
      id: '${END}'
      position:
        x: 800
        y: 300
      positionAbsolute:
        x: 800
        y: 300
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
      zIndex: 0
    viewport:
      x: 0
      y: 0
      zoom: 0.9
  rag_pipeline_variables: []
`;
}

const SKILLS = [
  {
    file: 'route-calc.yml',
    name: 'route-calc · 校园算路',
    desc: '输入起终点地名，返回步行折线、距离与耗时',
    icon: '🧭',
    bg: '#E8F0FA',
    codeTitle: 'Dijkstra 算路',
    startVars: [
      { name: 'from_name', label: '起点', required: true },
      { name: 'to_name', label: '终点', required: true },
    ],
    code: PY_ROUTE,
    outputs: { result: 'string' },
  },
  {
    file: 'place-lookup.yml',
    name: 'place-lookup · 地名解析',
    desc: '把口语化地名解析成校园地点与坐标',
    icon: '📍',
    bg: '#FDECEE',
    codeTitle: '别名匹配',
    startVars: [{ name: 'query', label: '地名文本', required: true }],
    code: PY_PLACE,
    outputs: { result: 'string' },
  },
  {
    file: 'office-hours.yml',
    name: 'office-hours · 办公时间',
    desc: '判断某个办事事项此刻是否能办',
    icon: '🕘',
    bg: '#FFF4E5',
    codeTitle: '时段解析',
    startVars: [
      { name: 'item_title', label: '事项名称', required: true },
      { name: 'campus', label: '校区(south/north)', required: false },
      { name: 'now', label: '时间(YYYY-MM-DD HH:MM，可空)', required: false },
    ],
    code: PY_HOURS,
    outputs: { result: 'string' },
  },
  {
    file: 'materials-check.yml',
    name: 'materials-check · 材料清单',
    desc: '返回办事材料、部门、电话与两校区办理点',
    icon: '📋',
    bg: '#E8F5EC',
    codeTitle: '清单查询',
    startVars: [
      { name: 'item_title', label: '事项名称', required: true },
      { name: 'campus', label: '校区(south/north)', required: false },
    ],
    code: PY_MATERIALS,
    outputs: { result: 'string' },
  },
];

fs.mkdirSync(OUT, { recursive: true });
for (const s of SKILLS) {
  const yaml = workflowYaml(s);
  fs.writeFileSync(path.join(OUT, s.file), yaml, 'utf8');
  console.log(s.file, (yaml.length / 1024).toFixed(1) + ' KB');
}
console.log('路网节点', graph.n.length, '边', graph.e.length, '地名', Object.keys(graph.p).length);
console.log('事项', services.length);
