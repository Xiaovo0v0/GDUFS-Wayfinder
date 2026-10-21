// 清理重复应用 + 取 WebApp 链接
//   node tools/dify_cleanup.mjs            # 只列出要删的，不执行
//   node tools/dify_cleanup.mjs --yes      # 真正删除
import { openDify } from './dify-lib.mjs';

const KEEP = {
  '80f06e29-0a32-40c1-971d-a91ab198af12': '尚行 · 广外校园向导（当前版本）',
  '4b1bccfe-3437-474f-acba-24ae9fef478d': 'materials-check（当前版本）',
  '6615e6a3-1013-49e1-94b8-a7acece03013': 'office-hours（当前版本）',
  'cfa4b844-ea57-45de-add2-29a47d15b8dd': 'place-lookup（当前版本）',
  '9ae8f3f0-2cc0-4025-8177-1ef5dd708bde': 'route-calc（当前版本）',
};

// 只删我自己反复导入产生的重复项，别人的应用一律不碰
const DELETE = [
  'b0fcba9d-3546-4ce6-97ec-c6924fd0dd6f',
  'bd67d0c6-7eff-4043-8e88-f57d3fd0b7b6',
  '8c76a24c-fc5c-4a88-9bba-666f6422a3c5',
  '7e6a8f58-32ab-4788-8229-f40bb0d25b23',
];

const yes = process.argv.includes('--yes');
const { api, close } = await openDify(9361);
try {
  // 当前主应用的 WebApp 链接
  for (const id of Object.keys(KEEP)) {
    const s = await api(`/console/api/apps/${id}/site`, { method: 'POST' });
    const tok = s.body && s.body.access_token;
    if (tok) {
      console.log(`KEEP  ${id}  ${KEEP[id]}\n      http://172.17.1.46/chat/${tok}`);
    }
  }

  console.log('\n待删除：');
  for (const id of DELETE) {
    const a = await api(`/console/api/apps/${id}`);
    const name = (a.body && a.body.name) || '(已不存在)';
    console.log(`  ${id}  ${name}`);
  }

  if (!yes) {
    console.log('\n（预演，未执行删除；加 --yes 真正删除）');
  } else {
    console.log('\n开始删除…');
    for (const id of DELETE) {
      const r = await api(`/console/api/apps/${id}`, { method: 'DELETE' });
      console.log(`  DELETE ${id} → ${r.status}`);
    }
    const left = await api('/console/api/apps?page=1&limit=100');
    console.log('剩余应用数:', (left.body && left.body.data ? left.body.data.length : '?'));
  }
} finally {
  await close();
}
