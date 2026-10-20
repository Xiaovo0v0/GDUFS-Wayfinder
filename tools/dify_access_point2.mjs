import { openDify, sleep } from './dify-lib.mjs';

const APP = 'cd9d369f-214d-44e3-a4a3-2e21b39f1e8f';
const { b, close } = await openDify(9372);
try {
  await b.goto(`http://172.17.1.46/app/${APP}/access-point`, 7000);
  await sleep(2500);
  const t = await b.eval(`document.body.innerText.replace(/\\n{2,}/g,'\\n').slice(0, 1600)`);
  console.log(t);
  const urls = [...new Set((t.match(/http[^\\s"'<>]+/g) || []))];
  console.log('\nURLS:', JSON.stringify(urls));
} finally {
  await close();
}
