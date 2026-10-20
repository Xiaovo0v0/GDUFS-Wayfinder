import { openDify } from './dify-lib.mjs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const { api, close } = await openDify(9341);
try {
  const paths = [
    `/console/api/datasets/${DS}/documents`,
    `/console/api/datasets/${DS}/documents/create-by-text`,
    `/console/api/datasets/${DS}/document/create-by-text`,
    `/console/api/datasets/${DS}/documents/text`,
    `/console/api/datasets/${DS}/documents/create-by-file`,
  ];
  for (const p of paths) {
    const r = await api(p, {
      method: 'POST',
      body: { name: 'probe.md', text: 'Q: 测试？\nA: 测试。', indexing_technique: 'high_quality', doc_form: 'qa_model', doc_language: 'Chinese', process_rule: { mode: 'automatic' } },
    });
    console.log(p, '->', r.status, typeof r.body === 'string' ? r.body.slice(0, 60) : JSON.stringify(r.body).slice(0, 160));
  }
} finally {
  await close();
}
