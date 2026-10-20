import { openDify } from './dify-lib.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify';
const DS1 = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const DS2 = 'be70e66b-8b9f-4429-8a73-1db3081abd59';

const { api, close } = await openDify(9381);
try {
  for (const [name, ds] of [['办事指南', DS1], ['校园百科', DS2]]) {
    for (const q of ['图书馆几层', '成绩单在哪里办']) {
      const r = await api(`/console/api/datasets/${ds}/retrieve`, {
        method: 'POST',
        body: {
          query: q,
          retrieval_model: {
            search_method: 'hybrid_search',
            reranking_enable: true,
            reranking_mode: 'reranking_model',
            reranking_model: {
              reranking_provider_name: 'langgenius/openai_api_compatible/openai_api_compatible',
              reranking_model_name: 'bge-reranker-v2-m3',
            },
            top_k: 4,
            score_threshold_enabled: false,
            score_threshold: null,
            weights: { weight_type: 'keyword_first', keyword_weight: 0.3, vector_weight: 0.7 },
          },
        },
      });
      const recs = r.body?.records || [];
      console.log(`\n[${name}] ${q} -> ${r.status}, ${recs.length} 条`);
      recs.slice(0, 3).forEach((x, i) => {
        console.log(`  ${i + 1}. score=${(x.score ?? 0).toFixed(3)} ${String(x.segment?.content || '').replace(/\n/g, ' ').slice(0, 110)}`);
      });
    }
  }
} finally {
  await close();
}
