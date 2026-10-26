// 重建两个知识库：删旧文档 → 传新语料 → 等索引完成
// 用法: node tools/dify_refresh_kb.mjs
import { openDify, sleep } from './dify-lib.mjs';
import fs from 'node:fs';

const ROOT = 'C:/Users/86134/Desktop/gdufs';
const DS_SERVICE = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const DS_WIKI = 'be70e66b-8b9f-4429-8a73-1db3081abd59';

const { b, api, close } = await openDify(9357);

async function purge(dsId, label) {
  const list = await api(`/console/api/datasets/${dsId}/documents?page=1&limit=50&keyword=&status=all`);
  const docs = list.body?.data || [];
  for (const d of docs) {
    const r = await api(`/console/api/datasets/${dsId}/documents/${d.id}`, { method: 'DELETE' });
    console.log(`[${label}] 删除 ${d.name} →`, r.status);
  }
  return docs.length;
}

async function upload(dsId, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const name = filePath.split(/[\\/]/).pop();
  const up = await b.eval(`(async () => {
    const m = document.cookie.match(/(?:^|; )csrf_token=([^;]+)/);
    const csrf = m ? decodeURIComponent(m[1]) : '';
    const fd = new FormData();
    fd.append('file', new File([${JSON.stringify(content)}], ${JSON.stringify(name)}, { type: 'text/markdown' }));
    const r = await fetch('/console/api/files/upload', { method: 'POST', body: fd, credentials: 'include', headers: { 'x-csrf-token': csrf } });
    const t = await r.text();
    try { return { status: r.status, body: JSON.parse(t) }; } catch { return { status: r.status, body: t.slice(0, 300) }; }
  })()`);
  if (!up.body?.id) throw new Error('upload failed: ' + JSON.stringify(up).slice(0, 300));

  const payload = {
    data_source: { type: 'upload_file', info_list: { data_source_type: 'upload_file', file_info_list: { file_ids: [up.body.id] } } },
    indexing_technique: 'high_quality',
    process_rule: {
      rules: {
        pre_processing_rules: [
          { id: 'remove_extra_spaces', enabled: false },
          { id: 'remove_urls_emails', enabled: false },
        ],
        segmentation: { separator: '\n\n', max_tokens: 1024, chunk_overlap: 0 },
      },
      mode: 'custom',
    },
    doc_form: 'text_model',
    doc_language: 'Chinese Simplified',
    embedding_model: 'bge-m3',
    embedding_model_provider: 'langgenius/openai_api_compatible/openai_api_compatible',
  };
  const doc = await api(`/console/api/datasets/${dsId}/documents`, { method: 'POST', body: payload });
  console.log('create doc', name, doc.status, doc.body?.documents?.[0]?.id || JSON.stringify(doc.body).slice(0, 200));
}

async function waitDone(dsId, label) {
  for (let i = 0; i < 45; i++) {
    await sleep(4000);
    const list = await api(`/console/api/datasets/${dsId}/documents?page=1&limit=20&keyword=&status=all`);
    const docs = list.body?.data || [];
    const st = docs.map((d) => `${d.indexing_status}/${d.segment_count ?? '-'}/${d.word_count ?? '-'}`);
    console.log(`[${label}] ${i}`, st.join(' , '));
    if (docs.length && docs.every((d) => d.indexing_status === 'completed' || d.indexing_status === 'error')) return docs;
  }
  return null;
}

try {
  await purge(DS_SERVICE, 'service');
  await upload(DS_SERVICE, `${ROOT}/data/dify/service_guide_qa.md`);
  const d1 = await waitDone(DS_SERVICE, 'service');
  console.log('service 完成:', JSON.stringify(d1?.map((d) => ({ s: d.indexing_status, seg: d.segment_count, w: d.word_count }))));

  await purge(DS_WIKI, 'wiki');
  await upload(DS_WIKI, `${ROOT}/data/dify/campus_wiki_qa.md`);
  const d2 = await waitDone(DS_WIKI, 'wiki');
  console.log('wiki 完成:', JSON.stringify(d2?.map((d) => ({ s: d.indexing_status, seg: d.segment_count, w: d.word_count }))));
} finally {
  await close();
}
