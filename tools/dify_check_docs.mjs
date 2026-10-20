import { openDify } from './dify-lib.mjs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const { api, close } = await openDify(9347);
try {
  const docs = await api(`/console/api/datasets/${DS}/documents?page=1&limit=20&keyword=&status=all`);
  console.log('docs:', JSON.stringify(docs.body?.data?.map?.(d => ({ id: d.id, name: d.name, form: d.doc_form, status: d.indexing_status, segs: d.segment_count })) || docs.body).slice(0, 800));
  const first = docs.body?.data?.[0];
  if (first) {
    const segs = await api(`/console/api/datasets/${DS}/documents/${first.id}/segments?page=1&limit=5&keyword=&status=all`);
    console.log('segments:', JSON.stringify(segs.body?.data?.map?.(s => ({ q: s.question, a: (s.answer||'').slice(0,60), content: (s.content||'').slice(0,60) })) || segs.body).slice(0, 1200));
  }
} finally {
  await close();
}
