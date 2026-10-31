import { Browser } from "./cdp.mjs";

const url = process.argv[2] || "http://127.0.0.1:8080/?lang=zh&campus=north";
const b = new Browser({ port: 9333 });
await b.launch();
await b.send("Page.enable");
await b.send("Runtime.enable");
await b.send("Log.enable");
await b.goto(url, 7000);
for (const ev of b.events) {
  if (ev.method === "Runtime.exceptionThrown") {
    const d = ev.params.exceptionDetails;
    console.log("EXCEPTION:", d.exception?.description || d.text, "@", d.url, d.lineNumber + 1);
  } else if (ev.method === "Log.entryAdded") {
    const e = ev.params.entry;
    console.log("LOG[" + e.level + "]:", e.text, e.url || "");
  } else if (ev.method === "Runtime.consoleAPICalled") {
    console.log("CONSOLE[" + ev.params.type + "]:", ev.params.args.map((a) => a.value ?? a.description).join(" "));
  }
}
const nav = await b.eval("typeof window.__navDebug").catch((e) => "evalfail " + e.message);
console.log("navDebug:", nav);
await b.close();
