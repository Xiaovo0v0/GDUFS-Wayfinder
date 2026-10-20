import { Browser } from './cdp.mjs';

const b = new Browser({ port: 9333, visible: false });
try {
  await b.launch('http://172.17.1.46/signin');
  await new Promise((r) => setTimeout(r, 4000));
  const info = await b.eval(`(() => {
    const inputs = [...document.querySelectorAll('input,button,textarea')].map(e => ({
      tag: e.tagName, type: e.type, id: e.id, name: e.name, ph: e.placeholder,
      text: (e.innerText||'').slice(0,40), cls: (e.className||'').toString().slice(0,80)
    }));
    return { url: location.href, title: document.title, inputs, bodyText: document.body.innerText.slice(0, 1200) };
  })()`);
  console.log(JSON.stringify(info, null, 2));
  await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/dify/00_signin.png');
} finally {
  await b.close();
}
