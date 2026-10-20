// 加强答案约束：只允许使用检索结果；检索不到就说未公布，不许编数字。
import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const appId = fs.readFileSync(`${OUT}/app-id.txt`, 'utf8').trim();

const ANSWER_PROMPT = `你是广东外语外贸大学大学城校区（南校区）的校园向导。请严格依据下面的【检索结果】回答，不要使用检索结果以外的知识。

用户问题：{{#sys.query#}}
意图与要素：{{#router.text#}}

【检索结果·办事指南】
{{#kr_service.result#}}

【检索结果·校园百科】
{{#kr_wiki.result#}}

输出要求：只输出一个 JSON 对象，不要代码块、不要任何多余文字：
{"intent":"navigate|service|wiki|chat","from":"","to":"","answer":"给用户看的中文回答","card":{"title":"","desc":"","url":""}}

硬性规则（违反会误导用户）：
1. 只允许使用上面两段【检索结果】里出现的事实。层数、房间号、电话、时间、金额这类具体信息，**检索结果里没有就写"官网未公布，建议电话咨询"**，绝对不要凭印象补。
2. 如果两段检索结果都为空或与问题无关，answer 只写"这个问题我在知识库里没找到，建议换个问法或直接联系相关部门"，不要编。
3. intent / from / to 沿用第一步结果；导航类要写清出发地、方向、地标、步行时间，并提醒南北校区只能走地下隧道。
4. 办事类要写清办理部门、地点（楼栋+房间号，仅限检索结果里有的）、材料、流程、电话。
5. 百科类先用一句话说位置，再补层数/功能/外观。
6. card.title 是地点或事项名；card.desc 一句话摘要；card.url 填检索结果里出现的来源链接（没有就留空）。
7. answer 控制在 200 字以内，不要出现"根据知识库""检索结果"这类字眼。`;

const { api, close } = await openDify(9382);
try {
  const draft = await api(`/console/api/apps/${appId}/workflows/draft`);
  const g = draft.body?.graph;
  console.log('draft', draft.status, 'hash', draft.body?.hash);

  let promptUpdated = 0, krUpdated = 0;
  for (const n of g.nodes) {
    const d = n.data || {};
    if (d.type === 'llm' && d.title === '生成回答') {
      d.prompt_template[0].text = ANSWER_PROMPT;
      d.model.completion_params = Object.assign({}, d.model.completion_params, { temperature: 0.1, max_tokens: 1024 });
      promptUpdated++;
    }
    if (d.type === 'knowledge-retrieval') {
      d.multiple_retrieval_config = d.multiple_retrieval_config || {};
      d.multiple_retrieval_config.top_k = 6;
      krUpdated++;
    }
  }
  console.log('promptUpdated', promptUpdated, 'krUpdated', krUpdated);

  const save = await api(`/console/api/apps/${appId}/workflows/draft`, {
    method: 'POST',
    body: { graph: g, features: draft.body.features, hash: draft.body.hash },
  });
  console.log('save', save.status, JSON.stringify(save.body).slice(0, 160));
  if (save.status === 200) {
    const pub = await api(`/console/api/apps/${appId}/workflows/publish`, {
      method: 'POST',
      body: { marked_name: '', marked_comment: '加强答案约束 + TopK 6' },
    });
    console.log('publish', pub.status);
  }
} finally {
  await close();
}
