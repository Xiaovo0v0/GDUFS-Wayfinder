// 抓取 Dify 前端 JS chunk，搜索文档创建相关的接口字段
import fs from 'node:fs';

const BASE = 'http://172.17.1.46';
const PAGE = '/datasets/1b06dcd0-5739-4f5a-8d4f-09653d7f7879/documents';
const OUT = 'C:/Users/86134/Desktop/gdufs/artifacts/dify/chunks';
fs.mkdirSync(OUT, { recursive: true });

const html = await (await fetch(BASE + PAGE)).text();
const srcs = [...new Set([...html.matchAll(/src="([^"]+\.js)"/g)].map(m => m[1]))];
console.log('chunks', srcs.length);

const hits = [];
for (const s of srcs) {
  const url = s.startsWith('http') ? s : BASE + s;
  try {
    const t = await (await fetch(url)).text();
    const name = s.split('/').pop();
    if (/data_source|info_list|create-by-text|doc_form|qa_model/.test(t)) {
      fs.writeFileSync(`${OUT}/${name}`, t, 'utf8');
      // 抓上下文字符串
      const idxs = [];
      const re = /data_source|info_list|create-by-text|qa_model/g;
      let m;
      while ((m = re.exec(t)) && idxs.length < 6) idxs.push(m.index);
      for (const i of idxs) {
        hits.push({ chunk: name, snippet: t.slice(Math.max(0, i - 260), i + 260) });
      }
    }
  } catch (e) { /* skip */ }
}
console.log('matched chunks', new Set(hits.map(h => h.chunk)).size);
fs.writeFileSync('C:/Users/86134/Desktop/gdufs/artifacts/dify/chunk-hits.json', JSON.stringify(hits, null, 2), 'utf8');
for (const h of hits.slice(0, 8)) {
  console.log('---', h.chunk, '---');
  console.log(h.snippet.replace(/\s+/g, ' ').slice(0, 400));
}
