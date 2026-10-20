import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const DS_SERVICE = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const DS_WIKI = 'be70e66b-8b9f-4429-8a73-1db3081abd59';
const MODEL = {
  provider: 'langgenius/openai_api_compatible/openai_api_compatible',
  name: 'DeepSeek-V4-Flash-0731',
  mode: 'chat',
  completion_params: { temperature: 0.2, max_tokens: 1024 },
};

const node = (id, type, title, data, pos) => ({
  id,
  type: 'custom',
  position: { x: pos[0], y: pos[1] },
  positionAbsolute: { x: pos[0], y: pos[1] },
  data: { type, title, desc: '', selected: false, ...data },
  width: 242,
  height: 110,
  sourcePosition: 'right',
  targetPosition: 'left',
  selected: false,
  dragging: false,
  zIndex: 0,
});

const edge = (s, t, st, tt, handle = 'source') => ({
  id: `${s}-${t}-${handle}`,
  type: 'custom',
  source: s,
  target: t,
  sourceHandle: handle,
  targetHandle: 'target',
  data: { isInIteration: false, isInLoop: false, sourceType: st, targetType: tt },
  selected: false,
  zIndex: 0,
});

const ROUTER_PROMPT = `你是广东外语外贸大学大学城校区（南校区）的校园向导，负责第一步意图识别与要素抽取。

用户问题：{{#sys.query#}}

请判断意图并抽取要素，只输出一个 JSON 对象，不要输出任何解释、不要用代码块包裹：
{"intent":"navigate|service|wiki|chat","from":"起点或空字符串","to":"终点或空字符串","place":"被问到的地点或空字符串"}

规则：
- navigate：用户想从 A 去 B、问怎么走、问某地在哪。
  from/to 必须使用校园内的规范地点名，例如：正门、行政出入口、1号门、2号门、3号门、4号门、图书馆、大会堂（教工活动中心）、艺术楼、体育馆（羽毛球馆）、体育场看台、教学楼A栋、教学楼B栋、教学楼C栋、教学楼D栋、教学楼E栋、教学楼F栋、教学楼G栋、实验楼A区、实验楼B区、实验楼C区、实验楼D区、实验楼E区、行政办公楼、院系办公楼、学术交流中心、B8学术报告厅、文采园（第一饭堂）、博雅园（第二饭堂）、风采园（第三饭堂）、北苑1栋…北苑6栋、南苑7栋…南苑13栋、师苑（C16/C18）、学生活动中心、门诊部（校医院）、后勤楼。
  用户没说起点时 from 留空；只说"怎么去某地"时 from 也留空。
- service：问办事流程、材料、去哪办、电话、时间（成绩单、选课、报销、校园卡、借书、宿舍报修等）。
- wiki：问某栋楼/某个食堂/某个校门是什么、在哪、几层、有什么。
- chat：打招呼、闲聊、与校园无关的问题。`;

const ANSWER_PROMPT = `你是广东外语外贸大学大学城校区的校园向导。请依据下面的信息回答用户。

用户问题：{{#sys.query#}}
第一步识别结果：{{#router.text#}}

办事指南知识库检索结果：
{{#kr_service.result#}}

校园百科知识库检索结果：
{{#kr_wiki.result#}}

输出要求（只输出一个 JSON 对象，不要代码块、不要多余文字）：
{"intent":"navigate|service|wiki|chat","from":"","to":"","answer":"给用户看的中文回答","card":{"title":"","desc":"","url":""}}

规则：
1. intent / from / to 沿用第一步结果；如果第一步判断为 navigate，answer 里写清楚"从哪出发、往哪个方向、经过什么地标、大概走多久"，并提醒南北校区只能走地下隧道。
2. 办事类问题：必须写清办理部门、地点（楼栋+房间号如有）、所需材料、流程、电话；知识库没有的信息就说"官网未公布，建议电话咨询"，不要编造房间号和电话。
3. 百科类问题：用一句话说清位置，再补充层数/功能/外观。
4. card 用于前端弹出小卡片：title 是地点或事项名，desc 一句话摘要，url 填知识库里的来源链接（没有就留空）。
5. answer 控制在 200 字以内，不要出现"根据知识库""检索结果"这类字眼。`;

const graph = {
  nodes: [
    node('start', 'start', '开始', { variables: [] }, [0, 300]),
    node('router', 'llm', '意图识别', {
      model: MODEL,
      prompt_template: [{ role: 'system', text: ROUTER_PROMPT }],
      context: { enabled: false, variable_selector: [] },
      memory: { role_prefix: { assistant: '', user: '' }, window: { enabled: false, size: 10 } },
      vision: { enabled: false },
      variables: [],
    }, [320, 300]),
    node('kr_service', 'knowledge-retrieval', '检索办事指南', {
      dataset_ids: [DS_SERVICE],
      query_variable_selector: ['start', 'sys.query'],
      retrieval_mode: 'multiple',
      multiple_retrieval_config: { top_k: 4, score_threshold: null, reranking_enable: true, reranking_mode: 'reranking_model', reranking_model: { reranking_provider_name: 'langgenius/openai_api_compatible/openai_api_compatible', reranking_model_name: 'bge-reranker-v2-m3' }, weights: null },
    }, [640, 120]),
    node('kr_wiki', 'knowledge-retrieval', '检索校园百科', {
      dataset_ids: [DS_WIKI],
      query_variable_selector: ['start', 'sys.query'],
      retrieval_mode: 'multiple',
      multiple_retrieval_config: { top_k: 4, score_threshold: null, reranking_enable: true, reranking_mode: 'reranking_model', reranking_model: { reranking_provider_name: 'langgenius/openai_api_compatible/openai_api_compatible', reranking_model_name: 'bge-reranker-v2-m3' }, weights: null },
    }, [640, 480]),
    node('llm_answer', 'llm', '生成回答', {
      model: MODEL,
      prompt_template: [{ role: 'system', text: ANSWER_PROMPT }],
      context: { enabled: false, variable_selector: [] },
      memory: { role_prefix: { assistant: '', user: '' }, window: { enabled: false, size: 10 } },
      vision: { enabled: false },
      variables: [],
    }, [980, 300]),
    node('answer', 'answer', '直接回复', { answer: '{{#llm_answer.text#}}', variables: [] }, [1300, 300]),
  ],
  edges: [
    edge('start', 'router', 'start', 'llm'),
    edge('router', 'kr_service', 'llm', 'knowledge-retrieval'),
    edge('router', 'kr_wiki', 'llm', 'knowledge-retrieval'),
    edge('kr_service', 'llm_answer', 'knowledge-retrieval', 'llm'),
    edge('kr_wiki', 'llm_answer', 'knowledge-retrieval', 'llm'),
    edge('llm_answer', 'answer', 'llm', 'answer'),
  ],
};

const features = {
  opening_statement: '你好！我是广外校园向导 🤖\n可以问我：「从文采园怎么去图书馆」「成绩单在哪办」「图书馆几层」',
  suggested_questions: ['从文采园怎么去图书馆？', '成绩单在哪里办？', '第一饭堂几点开门？', '一共有几个校门？'],
  suggested_questions_after_answer: { enabled: true },
  speech_to_text: { enabled: false },
  text_to_speech: { enabled: false, language: '', voice: '' },
  retriever_resource: { enabled: true },
  sensitive_word_avoidance: { enabled: false },
  file_upload: { image: { enabled: false, number_limits: 3, detail: 'high', transfer_methods: ['local_file', 'remote_url'] }, enabled: false, allowed_file_types: ['image'], allowed_file_extensions: [], allowed_file_upload_methods: ['local_file', 'remote_url'] },
};

const { api, close } = await openDify(9362);
try {
  const apps = await api('/console/api/apps?page=1&limit=50&name=&sort_by=last_modified');
  const exists = (apps.body?.data || []).find((a) => a.name === '广外校园向导');
  if (exists) {
    console.log('app already exists', exists.id, '- 删除后重建');
    await api(`/console/api/apps/${exists.id}`, { method: 'DELETE' });
  }

  const created = await api('/console/api/apps', {
    method: 'POST',
    body: { name: '广外校园向导', description: '广外大学城校区：校园导航 + 办事指南 + 校园百科', mode: 'advanced-chat', icon: '🧭', icon_background: '#E0F2FE' },
  });
  console.log('create app:', created.status, JSON.stringify(created.body).slice(0, 200));
  const appId = created.body?.id || created.body?.app?.id;
  if (!appId) throw new Error('no app id');

  const draft = await api(`/console/api/apps/${appId}/workflows/draft`, {
    method: 'POST',
    body: { graph, features },
  });
  console.log('save draft:', draft.status, JSON.stringify(draft.body).slice(0, 500));

  const pub = await api(`/console/api/apps/${appId}/workflows/publish`, { method: 'POST', body: { marked_name: '', marked_comment: '' } });
  console.log('publish:', pub.status, JSON.stringify(pub.body).slice(0, 300));

  fs.writeFileSync(`${OUT}/app-id.txt`, appId, 'utf8');
  fs.writeFileSync(`${OUT}/app-graph.json`, JSON.stringify(graph, null, 2), 'utf8');
} finally {
  await close();
}
