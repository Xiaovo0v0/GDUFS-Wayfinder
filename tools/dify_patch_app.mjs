// 就地改现有应用的提示词（不重新导入，避免换 app id / 换 API key）
//   node tools/dify_patch_app.mjs            # 只打 diff
//   node tools/dify_patch_app.mjs --write    # 改草稿并发布
import { openDify, sleep } from './dify-lib.mjs';

const WRITE = process.argv.includes('--write');

const NEW_QC = `判断用户在问哪一类问题，只选一个类别。

导航：用户明确要从一个地方走到另一个地方——出现「怎么走」「怎么去」「带我」「路线」「多远」「多久到」，
或者「X 在哪」并且目的是走过去。注意：只要问题里没有「从哪到哪」的移动意图，就不要选导航。

百科：问事实——某栋楼/某个食堂/某个校门是什么、在哪、几层、几个、有哪些、什么时候建的、长什么样。
「一共有几个校门」「有几个食堂」「有哪些教学楼」这类数量问题属于百科，不是导航。

办事：办手续、要材料、找部门、要电话、上班时间（成绩单、选课、报销、校园卡、借阅、宿舍报修等）。

闲聊：打招呼、与校园无关的问题。`;

const NEW_WIKI = `你是「校园百科专家」。

检索到的资料：
{{#wiki_kr.result#}}

用户原话：{{#sys.query#}}

依据资料回答，简洁准确。资料没有的就直说不知道。不要编造层数、面积、时间。
数量类问题（几个、多少、有哪些）先把数字说清楚，再逐条列出名字，一条一行。
若用户使用英文提问，请用英文回答；地名写成「中文名 (English name)」。若用中文提问则用中文。`;

const NEW_SVC = `你是「办事专家」，负责广外的办事指南。

【结构化事实】（由 materials-check + office-hours 两个技能算出来的，最可信，优先使用）：
{{#svc_code.result#}}

【检索到的资料】（用于补充说明与原文细节）：
{{#svc_kr.result#}}

用户原话：{{#sys.query#}}

要求：
- 地点、材料、电话、办公时段一律以【结构化事实】为准；资料里与它冲突时以结构化事实为准
- answer 必须以 status_text 的原句开头（例如"现在可以办理（17:10 下班）"或"今日已下班（下次开放 08:30）"），不要自己改写状态
- place_here 为空而 place_other 有值，要明确说"这件事只能去另一个校区办"
- answer 只写 4 行、**不超过 120 字**：第 1 行状态、第 2 行部门+地点、第 3 行办理时间、第 4 行电话。
  材料只列最关键的 2–3 条并加"等"，其余细节放进 card.desc。输出越短越好。
- 只输出一个 JSON 对象，不要代码块、不要任何解释：
{"intent":"service","answer":"4 行以内的简短回答","card":{"title":"事项名称","desc":"一句话说明 + 关键材料"}}

两条来源都没有的信息就写"官网未公布"，绝不编造。
若用户使用英文提问，请用英文回答；地名写成「中文名 (English name)」。若用中文提问则用中文。`;

const PATCH = { qc: NEW_QC, wiki_llm: NEW_WIKI, svc_llm: NEW_SVC };

const { api, close } = await openDify(9369);
try {
  const apps = await api('/console/api/apps?page=1&limit=40');
  const main = (apps.body?.data || []).find(a => a.mode === 'advanced-chat' && a.name.indexOf('尚行') === 0);
  console.log('目标应用:', main.name, main.id);

  const d = await api(`/console/api/apps/${main.id}/workflows/draft`);
  const graph = d.body?.graph;
  if (!graph) { console.log('拿不到草稿:', JSON.stringify(d.body).slice(0, 300)); process.exit(1); }

  let changed = 0;
  for (const n of graph.nodes) {
    const want = PATCH[n.id];
    if (!want) continue;
    if (n.data.type === 'question-classifier') {
      if (n.data.instruction !== want) { n.data.instruction = want; changed++; console.log('  改', n.id, '题目分类指令'); }
    } else {
      const m = n.data.prompt_template || [];
      const sys = m.find(x => x.role === 'system');
      if (sys && sys.text !== want) { sys.text = want; changed++; console.log('  改', n.id, '提示词'); }
    }
  }
  console.log('共修改 %d 处' % changed);

  if (!WRITE) { console.log('\n（只打 diff，加 --write 才写回）'); process.exit(0); }
  if (!changed) { console.log('无需写回'); process.exit(0); }

  const put = await api(`/console/api/apps/${main.id}/workflows/draft`, {
    method: 'POST',
    body: { graph, features: d.body.features, hash: d.body.hash },
  });
  console.log('保存草稿:', put.status, JSON.stringify(put.body).slice(0, 160));
  await sleep(800);

  const d2 = await api(`/console/api/apps/${main.id}/workflows/draft`);
  const hash = d2.body?.hash;
  const p = await api(`/console/api/apps/${main.id}/workflows/publish`, { method: 'POST', body: hash ? { hash } : {} });
  console.log('发布:', p.status, JSON.stringify(p.body).slice(0, 160));
} finally {
  await close();
}
