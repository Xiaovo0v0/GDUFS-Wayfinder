import { Browser } from './cdp.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = new Browser({ port: 9392, visible: false });
await b.launch(process.argv[2]);
await sleep(6000);
const s = await b.eval(`JSON.stringify({m:(window.__navDebug||{}).mode, b:(window.GDUFS_DATA||{}).buildings.length, trees:(window.__navDebug||{}).treeCount, glb: typeof window.GDUFS_GLB_URL})`, { awaitPromise: false });
console.log(s);
await b.shot('C:/Users/86134/Desktop/gdufs/artifacts/3d/v37_local_client.png');
await b.close();
