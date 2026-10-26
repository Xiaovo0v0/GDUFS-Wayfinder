// 直接测知识库召回：node tools/dify_probe_kb.mjs [查询1] [查询2] ...
import { openDify } from './dify-lib.mjs';

const DS_SERVICE = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const DS_WIKI = 'be70e66b-8b9f-4429-8a73-1db3081abd59';
const queries = process.argv.slice(2);
if (!queries.length) {
  queries.push('八角楼', '成绩单', '北校区第六教学楼', '相思河', '一共几个校区');
}

const { api, close } = await openDify(9358);
try {
  for (const ds of [
    { id: DS_WIKI, name: '百科' },
    { id: DS_SERVICE, name: '办事' },
  ]) {
    for (const q of queries) {
      const r = await api(`/console/api/datasets/${ds.id}/hit-testing`, {
        method: 'POST',
        body: { query: q, retrieval_model: { search_method: 'hybrid_search', reranking_enable: true, top_k: 3, score_threshold_enabled: false } },
      });
      const recs = r.body?.records || [];
      console.log(`\n[${ds.name}] ${q} → ${r.status}，命中 ${recs.length}`);
      for (const rec of recs.slice(0, 3)) {
        const seg = rec.segment || {};
        const head = String(seg.content || '').replace(/\n/g, ' / ').slice(0, 110);
        console.log(`  · ${(rec.score ?? 0).toFixed(3)}  ${head}`);
      }
    }
  }
} finally {
  await close();
}
