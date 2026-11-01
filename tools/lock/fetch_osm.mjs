// 抓取指定 bbox 的 OSM 道路/建筑/水系，用于给北校区（白云山校区）配准经纬度。
// 用法：node tools/lock/fetch_osm.mjs --out artifacts/lock/osm_north.json --bbox 23.170,113.278,23.192,113.302
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf("--" + k);
  return i >= 0 ? args[i + 1] : d;
};
const out = opt("out", "artifacts/lock/osm_north.json");
const bbox = opt("bbox", "23.170,113.278,23.192,113.302");

const query = `[out:json][timeout:90];
(
  way["highway"](${bbox});
  way["building"](${bbox});
  way["waterway"](${bbox});
  way["natural"="water"](${bbox});
  way["leisure"="track"](${bbox});
  way["leisure"="pitch"](${bbox});
  way["landuse"](${bbox});
);
out geom;`;

const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

let saved = false;
for (const ep of ENDPOINTS) {
  try {
    const url = ep + "?data=" + encodeURIComponent(query);
    const r = await fetch(url, {
      headers: { "user-agent": "gdufs-wayfinder/1.0 (campus georef)", accept: "application/json" },
    });
    const txt = await r.text();
    if (r.status !== 200) {
      console.log("miss", r.status, ep, txt.slice(0, 100).replace(/\s+/g, " "));
      continue;
    }
    const j = JSON.parse(txt);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(j));
    console.log("ok", ep, "elements", j.elements.length, "->", out);
    saved = true;
    break;
  } catch (e) {
    console.log("err", ep, e.message);
  }
}
if (!saved) {
  console.error("all endpoints failed");
  process.exit(1);
}
