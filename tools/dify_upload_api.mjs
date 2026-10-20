import { openDify, sleep } from './dify-lib.mjs';
import fs from 'node:fs';

const DS = fs.readFileSync('C:/Users/86134/Desktop/gdufs/artifacts/dify/dataset-id.txt', 'utf8').trim();
const FILE = process.argv[2] || 'C:/Users/86134/Desktop/gdufs/data/dify/service_guide_qa.md';
const DOCFORM = process.argv[3] || 'qa_model';
const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';

const { b, api, close } = await openDify(9351);
try {
  // 1) 上传文件，拿 file_id
  const up = await b.eval(`(async () => {
    const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
    const csrf = m ? decodeURIComponent(m[1]) : '';
    const content = ${JSON.stringify(fs.readFileSync(FILE, 'utf8'))};
    const name = ${JSON.stringify(FILE.split(/[\\\\/]/).pop())};
    const fd = new FormData();
    fd.append('file', new File([content], name, { type: 'text/markdown' }));
    const r = await fetch('/console/api/files/upload', { method: 'POST', body: fd, credentials: 'include', headers: { 'x-csrf-token': csrf } });
    const t = await r.text();
    try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t.slice(0, 300) }; }
  })()`);
  console.log('upload:', up.status, JSON.stringify(up.body).slice(0, 300));
  const fileId = up.body?.id;
  if (!fileId) throw new Error('no file id');

  // 2) 创建文档
  const payload = {
    data_source: { type: 'upload_file', info_list: { data_source_type: 'upload_file', file_info_list: { file_ids: [fileId] } } },
    indexing_technique: 'high_quality',
    process_rule: {
      rules: {
        pre_processing_rules: [
          { id: 'remove_extra_spaces', enabled: false },
          { id: 'remove_urls_emails', enabled: false },
        ],
        segmentation: { separator: '\n', max_tokens: 1024, chunk_overlap: 0 },
      },
      mode: 'custom',
    },
    doc_form: DOCFORM,
    doc_language: 'Chinese Simplified',
    embedding_model: 'bge-m3',
    embedding_model_provider: 'langgenius/openai_api_compatible/openai_api_compatible',
  };
  const doc = await api(`/console/api/datasets/${DS}/documents`, { method: 'POST', body: payload });
  console.log('create doc:', doc.status, JSON.stringify(doc.body).slice(0, 500));
  fs.writeFileSync(`${OUT}/doc-create-${DOCFORM}.json`, JSON.stringify(doc, null, 2));

  const docId = doc.body?.document?.id || doc.body?.id;
  // 3) 轮询状态
  for (let i = 0; i < 20; i++) {
    await sleep(2000);
    const list = await api(`/console/api/datasets/${DS}/documents?page=1&limit=20&keyword=&status=all`);
    const d = (list.body?.data || []).find(x => x.id === docId) || (list.body?.data || [])[0];
    if (!d) continue;
    if (d.indexing_status === 'completed' || d.indexing_status === 'error') {
      console.log('doc status:', d.indexing_status, 'segments:', d.segment_count, 'words:', d.word_count);
      break;
    }
  }
} finally {
  await close();
}
