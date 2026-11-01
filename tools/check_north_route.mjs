import { Browser } from "./cdp.mjs";

const port = Number(process.env.PORT || 9333);
const b = new Browser({ port });
await b.launch('about:blank');
const base = "http://127.0.0.1:8080/";

const cases = [
  ["北校", "?campus=north&lang=zh&ai=off", ["正门", "图书馆"], ["北门", "第一学生食堂"], ["南门", "图书馆"]],
];

async function main() {
  for (const [label, q, ...pairs] of cases) {
    await b.goto(base + q, 7000);
    for (const [from, to] of pairs) {
      const r = await b.eval(`(function(){
        var d = window.__navDebug;
        try {
          var ok = d.setPlaces(${JSON.stringify(from)}, ${JSON.stringify(to)});
          // 路线距离与路点数只出现在状态栏文案里，没有挂到 __navDebug 上，
          // 所以直接从 #status 的正则里取，别再读不存在的 d.routeInfo。
          var st = (document.querySelector("#status")||{}).textContent || "";
          var m = st.match(/(\\d+)\\s*米/), n = st.match(/(\\d+)\\s*个路点/);
          return JSON.stringify({ ok: ok, from: ${JSON.stringify(from)}, to: ${JSON.stringify(to)},
            dist: m ? Number(m[1]) : null,
            nodes: n ? Number(n[1]) : null,
            text: st.trim().slice(0, 80) });
        } catch (e) { return "ERR " + e.message; }
      })()`);
      console.log(label, r);
    }
  }
  await b.close();
}
main().catch(async (e) => { console.error("FAIL", e.message); try { await b.close(); } catch (_) {} process.exit(1); });

