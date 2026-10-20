import { openDify, sleep } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
fs.mkdirSync(OUT, { recursive: true });

const { api, close } = await openDify(9340);
try {
  // 现有知识库列表
  const list = await api('/console/api/datasets?limit=50&include_all=false&keyword=&page=1');
  console.log('datasets:', JSON.stringify(list.body?.data?.map?.((d) => ({ id: d.id, name: d.name })) || list.body).slice(0, 500));

  // 创建办事指南知识库
  const create = await api('/console/api/datasets', {
    method: 'POST',
    body: {
      name: '广外办事指南',
      description: '广外官网办事流程语料（40 条，Q&A 分段）',
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
        score_threshold_enabled: true,
        score_threshold: 0.3,
      },
    },
  });
  console.log('create:', create.status, JSON.stringify(create.body).slice(0, 600));
  fs.writeFileSync(`${OUT}/dataset-create.json`, JSON.stringify(create, null, 2));

  if (create.status === 201 || create.status === 200) {
    const ds = create.body;
    fs.writeFileSync(`${OUT}/dataset-id.txt`, ds.id, 'utf8');

    // 上传一段测试文档，验证 Q&A 分段格式
    const text = 'Q: 测试问题一？\nA: 测试答案一\n\nQ: 测试问题二？\nA: 测试答案二';
    const up = await api(`/console/api/datasets/${ds.id}/document/create-by-text`, {
      method: 'POST',
      body: {
        name: 'qa_format_test.md',
        text,
        indexing_technique: 'high_quality',
        doc_form: 'qa_model',
        doc_language: 'Chinese',
        process_rule: { mode: 'automatic' },
      },
    });
    console.log('upload:', up.status, JSON.stringify(up.body).slice(0, 600));
    fs.writeFileSync(`${OUT}/doc-upload.json`, JSON.stringify(up, null, 2));
  }
} finally {
  await close();
}
