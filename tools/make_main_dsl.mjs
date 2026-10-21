// 生成主应用 DSL：路由 + 三个专家分支 + 汇总
//   node tools/make_main_dsl.mjs
// 产出 skills/dsl/main-app.yml
//
// 结构：
//   开始 → 意图路由(question-classifier)
//      ├ 导航 → 算路代码节点（Skill: route-calc）    → 导航专家 LLM ┐
//      ├ 办事 → 检索办事库 → 事项结构化节点（Skill:   ├→ 汇总 → 回答
//      │                    materials-check + office-hours）→ 办事专家 LLM ┤
//      ├ 百科 → 检索百科库                            → 百科专家 LLM ┤
//      └ 闲聊 → 直接 LLM                                            ┘

import fs from 'node:fs';
import path from 'node:path';

const REPO = 'C:/Users/86134/Desktop/gdufs';
const OUT = path.join(REPO, 'skills/dsl/main-app.yml');

// 办事事项数据（给 materials-check / office-hours 两个技能用）
const svcJs = fs.readFileSync(path.join(REPO, 'gdufs-3d/service-data.js'), 'utf8');
const SERVICES = JSON.parse(svcJs.slice(svcJs.indexOf('['), svcJs.lastIndexOf(';'))).map((s) => ({
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


// 复用 route-calc 的 Python 代码，避免两份实现漂移
const routeYml = fs.readFileSync(path.join(REPO, 'skills/dsl/route-calc.yml'), 'utf8');
const codeStart = routeYml.indexOf('        code: |-') + '        code: |-'.length;
const codeEnd = routeYml.indexOf('        outputs:', codeStart);
const ROUTE_PY_RAW = routeYml.slice(codeStart, codeEnd).replace(/\n {10}/g, '\n').trim();

// 主应用的算路节点只有一个输入（用户原话），所以把原 main 改名成 _route，
// 再补一个从原话里抽起终点的 main。
const ROUTE_PY = ROUTE_PY_RAW
  .replace('def main(from_name: str, to_name: str) -> str:', 'def _route(from_name: str, to_name: str) -> str:')
  + `

def main(query: str) -> str:
    import re as _re
    ALIAS = {"一饭": "文采园", "二饭": "博雅园", "三饭": "风采园",
             "校医院": "门诊部", "大门": "正门", "会堂": "大会堂"}
    q = query
    for a, b in ALIAS.items():
        q = q.replace(a, b)
    # 英文提问：把英文地名对应的中文标准名补到句尾，再走中文匹配
    low = q.lower()
    for en, zh in sorted(G.get("en", {}).items(), key=lambda kv: -len(kv[0])):
        if en and en in low and zh not in q:
            q = q + " " + zh
    cands = []
    for label in G["p"]:
        core = _re.sub(r"[（(].*?[）)]", "", label)
        pos = -1
        for form in (label, core):
            if form and form in q:
                pos = max(pos, q.find(form))
        if pos >= 0:
            cands.append((pos, label))
    cands.sort()
    names = []
    for _, lab in cands:
        if lab not in names:
            names.append(lab)
    if len(names) >= 2:
        return _route(names[0], names[1])
    if len(names) == 1:
        return _out({"ok": False, "error": "只识别到一个地点，请补充起点或终点", "place": names[0]}, ensure_ascii=False)
    return _out({"ok": False, "error": "未识别到校园地点"}, ensure_ascii=False)
`;

const SERVICE_DS = 'oAg72XjWiBUWdxd3b15jMZMNPv5OuVzAMcSJBcczuSfURfyxQTFS/mpYoRThFpcE';
const WIKI_DS = 'jcEiWCnYSMTT/UtRIH1riaYYcyfAQtahp7Cjj98ofJEAYVF17RM3M39XAjff47Fh';
// 模型名可用环境变量覆盖：GDUFS_MODEL=Qwen3.8-27B node tools/make_main_dsl.mjs
const MODEL_NAME = process.env.GDUFS_MODEL || 'Qwen3.8-27B';
const MODEL = `mode: chat
          name: ${MODEL_NAME}
          provider: langgenius/openai_api_compatible/openai_api_compatible`;

const indent = (s, n) => s.split('\n').map((l) => (l ? ' '.repeat(n) + l : l)).join('\n');

// ---------- 公共片段 ----------
const edge = (src, tgt, srcType, tgtType, handle = 'source') => `    - data:
        isInIteration: false
        isInLoop: false
        sourceType: ${srcType}
        targetType: ${tgtType}
      id: ${src}-${handle}-${tgt}-target
      selected: false
      source: '${src}'
      sourceHandle: '${handle}'
      target: '${tgt}'
      targetHandle: target
      type: custom
      zIndex: 0`;

const nodeTail = (id, x, y) => `      dragging: false
      height: 90
      id: ${id}
      position:
        x: ${x}
        y: ${y}
      positionAbsolute:
        x: ${x}
        y: ${y}
      selected: false
      sourcePosition: right
      targetPosition: left
      type: custom
      width: 242
      zIndex: 0`;

const llmNode = (id, title, x, y, systemPrompt, opts = {}) => {
  const ctx = opts.context
    ? `        context:
          enabled: true
          variable_selector:
          - ${opts.context}
          - result`
    : `        context:
          enabled: false
          variable_selector: []`;
  const memory = opts.memory === false
    ? `        memory:
          role_prefix:
            assistant: ''
            user: ''
          window:
            enabled: false
            size: 10`
    : `        memory:
          role_prefix:
            assistant: ''
            user: ''
          window:
            enabled: true
            size: 10`;
  return `    - data:
${ctx}
        desc: ''
${memory}
        model:
          completion_params:
            max_tokens: ${opts.maxTokens || 900}
            temperature: ${opts.temperature != null ? opts.temperature : 0.3}
          ${MODEL}
        prompt_template:
        - id: ${id}-sys
          role: system
          text: |-
${indent(systemPrompt, 12)}
        selected: false
        title: ${title}
        type: llm
        variables: []
        vision:
          enabled: false
${nodeTail(id, x, y)}`;
};

// ---------- 提示词 ----------
const LANGFOLLOW = `
若用户使用英文提问，请用英文回答；地名写成「中文名 (English name)」。若用中文提问则用中文。`;

const NAV_PROMPT = `你是「导航专家」，负责校园步行导航。

算路工具已返回结果（JSON）：
{{#nav_code.result#}}

用户原话：{{#sys.query#}}

只输出一个 JSON 对象，不要代码块、不要任何解释：
{"intent":"navigate","from":"起点标准名","to":"终点标准名","answer":"一句话说明步行距离与耗时","via":["途经点1","途经点2"]}

要求：
- from / to 必须与算路结果里的 from / to 完全一致
- answer 用中文，一句到两句，说明距离（米）与耗时（分钟），不要重复罗列坐标
- via 从 points 提炼 3–5 个，没有就给空数组
- 若算路结果 ok 为 false，输出：{"intent":"chat","answer":"<解释原因并建议换个地点名>"}`;

const SVC_PROMPT = `你是「办事专家」，负责广外的办事指南。

【结构化事实】（由 materials-check + office-hours 两个技能算出来的，最可信，优先使用）：
{{#svc_code.result#}}

【检索到的资料】（用于补充说明与原文细节）：
{{#svc_kr.result#}}

用户原话：{{#sys.query#}}

要求：
- 地点、材料、电话、办公时段一律以【结构化事实】为准；资料里与它冲突时以结构化事实为准
- answer 必须以 status_text 的原句开头（例如"现在可以办理（17:10 下班）"或"今日已下班（下次开放 08:30）"），不要自己改写状态
- place_here 为空而 place_other 有值，要明确说"这件事只能去另一个校区办"
- 只输出一个 JSON 对象，不要代码块、不要任何解释：
{"intent":"service","answer":"面向用户的完整回答：状态 + 部门、地点（校区+楼栋+房间）、办理时间、所需材料、电话","card":{"title":"事项名称","desc":"一句话说明"}}

两条来源都没有的信息就写"官网未公布"，绝不编造。
${LANGFOLLOW}`;

// 办事分支的结构化节点：把 materials-check 与 office-hours 两个技能的逻辑合起来跑，
// 直接给出材料、电话、双校区办理点、此刻是否可办，再交给 LLM 组织语言。
const SVC_PY = `
import json
import re
from datetime import datetime, timezone, timedelta

CST = timezone(timedelta(hours=8))


def _now():
    # Dify 代码沙箱跑在 UTC，这里强制按北京时间判断"现在能不能办"
    return datetime.now(CST).replace(tzinfo=None)


SERVICES = json.loads(r"""__SERVICE__""")

WD = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "日": 0, "天": 0}


def _out(obj, **kw):
    return {"result": json.dumps(obj, ensure_ascii=False)}


def _lcs(a, b):
    if not a or not b:
        return 0
    best = 0
    prev = [0] * (len(b) + 1)
    for i in range(1, len(a) + 1):
        cur = [0] * (len(b) + 1)
        ai = a[i - 1]
        for j in range(1, len(b) + 1):
            if ai == b[j - 1]:
                cur[j] = prev[j - 1] + 1
                if cur[j] > best:
                    best = cur[j]
        prev = cur
    return best


def _match(query):
    q = re.sub(r"[\\s，。？?、,.]", "", query or "")
    best, bs = None, 0
    for s in SERVICES:
        t = re.sub(r"[（(].*?[）)]", "", s.get("title") or "")
        t = re.sub(r"[\\s、/]", "", t)
        if not t:
            continue
        sc = _lcs(q, t)
        if sc > bs:
            bs, best = sc, s
    return (best, bs)


def _hours(text, campus):
    segs = [x for x in re.split(r"[；;]", text or "") if x.strip()]
    key = ["北校区", "北校"] if campus == "north" else ["南校区", "南校", "大学城"]
    hit = [x for x in segs if any(k in x for k in key)]
    src = "；".join(hit if hit else segs)

    # 先看是不是"日期区间"（报名窗口），别把 9 月 15 日～9 月 28 日 当成每天的 12:00-17:00
    md = re.search(r"(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日[^至到]*?(\\d{1,2})[:：](\\d{2})\\s*[至到\\-–~]+\\s*(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日[^至到]*?(\\d{1,2})[:：](\\d{2})", src)
    if md:
        now = _now()
        y = now.year
        try:
            start = datetime(y, int(md.group(1)), int(md.group(2)), int(md.group(3)), int(md.group(4)))
            end = datetime(y, int(md.group(5)), int(md.group(6)), int(md.group(7)), int(md.group(8)))
        except ValueError:
            start = end = None
        if start and end:
            if end < start:
                end = end.replace(year=y + 1)
            return {"known": True, "open": start <= now <= end, "mode": "date_range",
                    "open_at": start.strftime("%m-%d %H:%M"), "close_at": end.strftime("%m-%d %H:%M"),
                    "note": src}

    days = []
    for m in re.finditer(r"周([一二三四五六日天])", src):
        d = WD.get(m.group(1))
        if d is not None and d not in days:
            days.append(d)
    ranges = []
    for m in re.finditer(r"(\\d{1,2})[:：](\\d{2})\\s*[-–~至]\\s*(\\d{1,2})[:：](\\d{2})", src):
        ranges.append([int(m.group(1)) * 60 + int(m.group(2)), int(m.group(3)) * 60 + int(m.group(4))])
    if not ranges:
        return {"known": False, "note": src or "官网未公布"}
    now = _now()
    dow = now.isoweekday() % 7
    mins = now.hour * 60 + now.minute

    def hhmm(v):
        return "%02d:%02d" % (v // 60, v % 60)

    open_now = bool((dow in days if days else True) and any(a <= mins <= b for a, b in ranges))
    return {"known": True, "open": open_now, "mode": "weekly", "days": days,
            "open_at": hhmm(ranges[0][0]), "close_at": hhmm(ranges[-1][1]), "note": src}


def main(query: str) -> str:
    campus = "north" if re.search(r"北校|白云山", query or "") else "south"
    svc, score = _match(query)
    if svc is None or score < 3:
        return _out({"ok": False, "error": "未匹配到具体事项", "score": score})
    here = svc.get(campus) or []
    other_key = "north" if campus == "south" else "south"
    other = svc.get(other_key) or []
    h = _hours(svc.get("hours") or "", campus)

    # 给 LLM 一句可直接引用的状态语，避免它自己发挥
    if not h.get("known"):
        status = "官网未公布办公时间"
    elif h.get("mode") == "date_range":
        status = ("当前处于受理窗口内（截止 %s）" % h["close_at"]) if h.get("open") \
            else ("受理窗口已结束（%s 至 %s）" % (h["open_at"], h["close_at"]))
    else:
        status = ("现在可以办理（%s 下班）" % h["close_at"]) if h.get("open") \
            else ("今日已下班（下次开放 %s）" % h["open_at"])

    return _out({
        "ok": True,
        "item": svc.get("title"),
        "department": svc.get("dept"),
        "materials": svc.get("materials"),
        "phone": svc.get("phone"),
        "online": svc.get("online"),
        "campus": campus,
        "hours": h,
        "status_text": status,
        "place_here": here[0] if here else None,
        "place_other": other[0] if other else None,
        "url": svc.get("url"),
        "match_score": score,
    })
`.trim();

const WIKI_PROMPT = `你是「校园百科专家」。

检索到的资料：
{{#wiki_kr.result#}}

用户原话：{{#sys.query#}}

依据资料回答，简洁准确。资料没有的就直说不知道。不要编造层数、面积、时间。
${LANGFOLLOW}`;

const CHAT_PROMPT = `你是「语心」，广东外语外贸大学校园向导。

用户：{{#sys.query#}}

如果是打招呼，简短自我介绍：你能做校园导航（会在地图上画出路线）和办事指南。
如果是与校园无关的问题，礼貌说明你只负责广外校园相关事务。回答控制在两三句。
${LANGFOLLOW}`;

// ---------- 组装 ----------
const CLASSES = [
  { id: '1', name: '导航' },
  { id: '2', name: '办事' },
  { id: '3', name: '百科' },
  { id: '4', name: '闲聊' },
];

const edges = [
  edge('start', 'qc', 'start', 'question-classifier'),
  edge('qc', 'nav_code', 'question-classifier', 'code', '1'),
  edge('qc', 'svc_kr', 'question-classifier', 'knowledge-retrieval', '2'),
  edge('qc', 'wiki_kr', 'question-classifier', 'knowledge-retrieval', '3'),
  edge('qc', 'chat_llm', 'question-classifier', 'llm', '4'),
  edge('nav_code', 'nav_llm', 'code', 'llm'),
  edge('nav_llm', 'agg', 'llm', 'variable-aggregator'),
  edge('svc_kr', 'svc_code', 'knowledge-retrieval', 'code'),
  edge('svc_code', 'svc_llm', 'code', 'llm'),
  edge('svc_llm', 'agg', 'llm', 'variable-aggregator'),
  edge('wiki_kr', 'wiki_llm', 'knowledge-retrieval', 'llm'),
  edge('wiki_llm', 'agg', 'llm', 'variable-aggregator'),
  edge('chat_llm', 'agg', 'llm', 'variable-aggregator'),
  edge('agg', 'answer', 'variable-aggregator', 'answer'),
].join('\n');

const krNode = (id, title, x, y, ds) => `    - data:
        dataset_ids:
        - ${ds}
        desc: ''
        multiple_retrieval_config:
          reranking_enable: true
          reranking_mode: reranking_model
          reranking_model:
            provider: ''
            reranking_model_name: bge-reranker-v2-m3
            reranking_provider_name: langgenius/openai_api_compatible/openai_api_compatible
          score_threshold: null
          top_k: 6
          weights: null
        query_variable_selector:
        - start
        - sys.query
        retrieval_mode: multiple
        selected: false
        title: ${title}
        type: knowledge-retrieval
${nodeTail(id, x, y)}`;

const yaml = `app:
  description: 广外校园向导 · 路由 + 导航/办事/百科 三专家协同
  icon: 🧭
  icon_background: '#E8F0FA'
  icon_type: emoji
  mode: advanced-chat
  name: 尚行 · 广外校园向导
  use_icon_as_answer_icon: false
kind: app
version: 0.7.0
workflow:
  conversation_variables: []
  environment_variables: []
  features:
    file_upload:
      allowed_file_extensions: []
      allowed_file_types:
      - image
      allowed_file_upload_methods:
      - local_file
      - remote_url
      enabled: false
      image:
        detail: high
        enabled: false
        number_limits: 3
        transfer_methods:
        - local_file
        - remote_url
    opening_statement: |-
      我是语心。可以直接问我：

      · 从文采园怎么去图书馆
      · 成绩单在哪办
      · 图书馆几层
    retriever_resource:
      enabled: true
    sensitive_word_avoidance:
      enabled: false
    speech_to_text:
      enabled: false
    suggested_questions:
    - 从文采园怎么去图书馆？
    - 成绩单在哪里办？
    - 图书馆几层？
    - 一共有几个校门？
    suggested_questions_after_answer:
      enabled: true
    text_to_speech:
      enabled: false
      language: ''
      voice: ''
  graph:
    edges:
${edges}
    nodes:
    - data:
        desc: ''
        selected: false
        title: 开始
        type: start
        variables: []
${nodeTail('start', 0, 300)}
    - data:
        classes:
${CLASSES.map((c) => `        - id: '${c.id}'
          name: ${c.name}`).join('\n')}
        desc: ''
        instruction: |-
          判断用户在问哪一类问题，只选一个类别。

          导航：想从 A 去 B、问怎么走、某地在哪里、要多久。
          办事：问办事流程、材料、去哪办、找哪个部门、电话、办公时间（成绩单、选课、报销、校园卡、借阅、宿舍报修等）。
          百科：问某栋楼/某个食堂/某个校门是什么、几层、有什么特色。
          闲聊：打招呼、与校园无关的问题。
        model:
          completion_params:
            temperature: 0
          ${MODEL}
        query_variable_selector:
        - start
        - sys.query
        selected: false
        title: 意图路由
        type: question-classifier
${nodeTail('qc', 300, 300)}
    - data:
        selected: false
        title: '算路（Skill: route-calc）'
        type: code
        code_language: python3
        variables:
        - value_selector:
          - start
          - sys.query
          variable: query
        code: |-
${indent(ROUTE_PY, 10)}
        outputs:
          result:
            type: string
            children: null
${nodeTail('nav_code', 600, 140)}
${llmNode('nav_llm', '导航专家', 900, 140, NAV_PROMPT + LANGFOLLOW, { context: 'nav_code', temperature: 0.2, memory: false })}
${krNode('svc_kr', '检索办事指南', 560, 300, SERVICE_DS)}
    - data:
        selected: false
        title: '事项结构化（Skill: materials-check + office-hours）'
        type: code
        code_language: python3
        variables:
        - value_selector:
          - start
          - sys.query
          variable: query
        code: |-
${indent(SVC_PY.replace('__SERVICE__', JSON.stringify(SERVICES)), 10)}
        outputs:
          result:
            type: string
            children: null
${nodeTail('svc_code', 860, 300)}
${llmNode('svc_llm', '办事专家', 1160, 300, SVC_PROMPT + LANGFOLLOW, { context: 'svc_kr' })}
${krNode('wiki_kr', '检索校园百科', 600, 460, WIKI_DS)}
${llmNode('wiki_llm', '百科专家', 900, 460, WIKI_PROMPT + LANGFOLLOW, { context: 'wiki_kr' })}
${llmNode('chat_llm', '闲聊', 900, 620, CHAT_PROMPT + LANGFOLLOW, { temperature: 0.6, maxTokens: 300 })}
    - data:
        desc: ''
        output_type: string
        selected: false
        title: 汇总
        type: variable-aggregator
        variables:
        - - nav_llm
          - text
        - - svc_llm
          - text
        - - wiki_llm
          - text
        - - chat_llm
          - text
${nodeTail('agg', 1200, 300)}
    - data:
        answer: '{{#agg.output#}}'
        desc: ''
        selected: false
        title: 回答
        type: answer
        variables: []
${nodeTail('answer', 1500, 300)}
    viewport:
      x: 0
      y: 0
      zoom: 0.62
  rag_pipeline_variables: []
`;

fs.writeFileSync(OUT, yaml, 'utf8');
console.log('输出', OUT, (yaml.length / 1024).toFixed(1) + ' KB');
