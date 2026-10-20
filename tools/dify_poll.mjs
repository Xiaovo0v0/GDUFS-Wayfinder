import { openDify, sleep } from './dify-lib.mjs';

const DS = '1b06dcd0-5739-4f5a-8d4f-09653d7f7879';
const { api, close } = await openDify(9354);
try {
  for (let i = 0; i < 60; i++) {
    const list = await api(`/console/api/datasets/${DS}/documents?page=1&limit=20&keyword=&status=all`);
    const d = (list.body?.data || [])[0];
    console.log(i, d?.indexing_status, 'segs=', d?.segment_count, 'words=', d?.word_count);
    if (!d) break;
    if (d.indexing_status === 'completed' || d.indexing_status === 'error') {
      console.log('done:', JSON.stringify({ status: d.indexing_status, segs: d.segment_count, words: d.word_count, err: d.error }));
      break;
    }
    await sleep(5000);
  }
} finally {
  await close();
}
