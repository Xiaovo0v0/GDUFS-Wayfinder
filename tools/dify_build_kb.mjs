import { openDify, sleep } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const { b, api, close } = await openDify(9356);

async function uploadToDataset(dsId, filePath, docForm = 'text_model', separator = '\n\n') {
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
        segmentation: { separator, max_tokens: 1024, chunk_overlap: 0 },
      },
      mode: 'custom',
    },
    doc_form: docForm,
    doc_language: 'Chinese Simplified',
    embedding_model: 'bge-m3',
    embedding_model_provider: 'langgenius/openai_api_compatible/openai_api_compatible',
  };
  const doc = await api(`/console/api/datasets/${dsId}/documents`, { method: 'POST', body: payload });
  console.log('create doc', name, doc.status, doc.body?.documents?.[0]?.id || JSON.stringify(doc.body).slice(0, 200));
  return doc.body?.documents?.[0]?.id;
}

async function waitDone(dsId, label) {
  for (let i = 0; i < 40; i++) {
    await sleep(4000);
    const list = await api(`/console/api/datasets/${dsId}/documents?page=1&limit=20&keyword=&status=all`);
    const docs = list.body?.data || [];
    const st = docs.map((d) => `${d.indexing_status}/${d.segment_count ?? '-'}`);
    console.log(label, i, st.join(','));
    if (docs.length && docs.every((d) => d.indexing_status === 'completed' || d.indexing_status === 'error')) {
      return docs;
    }
  }
  return null;
}

try {
  // ---- 1. 办事指南：删掉卡住的文档，改用 text_model ----
  const DS1 = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
  const old = await api(`/console/api/datasets/${DS1}/documents?page=1&limit=20&keyword=&status=all`);
  for (const d of old.body?.data || []) {
    const r = await api(`/console/api/datasets/${DS1}/documents/${d.id}`, { method: 'DELETE' });
    console.log('deleted stuck doc', d.name, r.status);
  }
  await uploadToDataset(DS1, 'C:/Users/86134/Desktop/gdufs/data/dify/service_guide_qa.md');
  const done1 = await waitDone(DS1, 'service');
  console.log('service done:', JSON.stringify(done1?.map((d) => ({ s: d.indexing_status, seg: d.segment_count, w: d.word_count }))));

  // ---- 2. 校园百科：新建知识库 ----
  const created = await api('/console/api/datasets', {
    method: 'POST',
    body: {
      name: '广外校园百科',
      description: '建筑/场馆/食堂/校门 的官方档案（101 条，Q&A 文本）',
      indexing_technique: 'high_quality',
      permission: 'only_me',
      provider: 'vendor',
      embedding_model: 'bge-m3',
      embedding_model_provider: 'langgenius/openai_api_compatible/openai_api_compatible',
      retrieval_model: {
        retrieval_method: 'hybrid_search',
        reranking_enable: true,
        reranking_mode: 'reranking_model',
        reranking_model: {
          reranking_provider_name: 'langgenius/openai_api_compatible/openai_api_compatible',
          reranking_model_name: 'bge-reranker-v2-m3',
        },
        top_k: 4,
        score_threshold_enabled: false,
        score_threshold: 0.3,
      },
    },
  });
  console.log('dataset2', created.status, created.body?.id);
  if (created.body?.id) {
    fs.writeFileSync(`${OUT}/dataset2-id.txt`, created.body.id, 'utf8');
    await uploadToDataset(created.body.id, 'C:/Users/86134/Desktop/gdufs/data/dify/campus_wiki_qa.md');
    const done2 = await waitDone(created.body.id, 'wiki');
    console.log('wiki done:', JSON.stringify(done2?.map((d) => ({ s: d.indexing_status, seg: d.segment_count, w: d.word_count }))));
  }
} finally {
  await close();
}
