import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9390, visible: false });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
try {
  await b.launch('http://127.0.0.1:54828');
  await sleep(5000);
  const info = await b.eval(`({
    url: location.href,
    title: document.title,
    buttons: [...document.querySelectorAll('button,[role="button"],a')]
      .map(e => (e.innerText || e.getAttribute('aria-label') || '').trim())
      .filter(Boolean).slice(0, 60),
    text: document.body.innerText.replace(/\\n{2,}/g, '\\n').slice(0, 800)
  })`);
  console.log(JSON.stringify(info, null, 2));
} finally {
  await b.close();
}
