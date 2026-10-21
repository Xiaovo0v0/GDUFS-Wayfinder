// 清理重复应用 + 取 WebApp 链接
//   node tools/dify_cleanup.mjs            # 只列出要删的，不执行
//   node tools/dify_cleanup.mjs --yes      # 真正删除
import { openDify } from './dify-lib.mjs';

const KEEP = {
  'b8d5c8c2-1c39-48bd-a6f8-284e81a108c5': '尚行 · 广外校园向导（当前版本）',
  '4b1bccfe-3437-474f-acba-24ae9fef478d': 'materials-check（当前版本）',
  '7e6a8f58-32ab-4788-8229-f40bb0d25b23': 'office-hours（当前版本）',
  'cfa4b844-ea57-45de-add2-29a47d15b8dd': 'place-lookup（当前版本）',
  '9ae8f3f0-2cc0-4025-8177-1ef5dd708bde': 'route-calc（当前版本）',
};

// 只删我自己反复导入产生的重复项，别人的应用一律不碰
const DELETE = [
  '9547ac4a-2cfb-4e35-ab32-601b863374ed',
  '7673c750-06f2-4276-9ac9-52f4b4dce0e6',
  'd0e04d58-7345-4fd6-976b-f7d88196f278',
  'ed2d59ee-dd99-47ce-b78f-a1139737fd5e',
  '32b90337-e2a2-4dbf-96fd-b3f798dc069b',
  '7808d416-1332-4cb6-b64f-a8980be3b514',
  'ee407a00-180e-4dae-b226-aeb6dc291910',
  '660e6551-76ce-4739-b1cf-a877ad9fed30',
  '590a4ec2-2993-4f69-804b-4d6b96f567e6',
  'ba0ca13f-0a61-446a-ab6d-a7226fcac52a',
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
