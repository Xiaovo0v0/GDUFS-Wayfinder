# AGENTS.md

给在这个仓库里干活的 agent（也给我自己）。只写**不读就会踩坑**的东西；
项目背景、数据来源、历史决策都在 `docs/`，不要往这里抄。

产品：`gdufs-3d/` —— 广外校园导航，Three.js r128，**无构建、无 npm 依赖**，
`index.html` + 一组 `*.js`，双击 `start.cmd` 或 `serve.ps1` 就能跑。

## 三条硬规则

1. **含中文的文件不许过 PowerShell 管道。**
   本机默认 shell 是 PowerShell 5.1，按 GBK 读无 BOM 的 UTF-8：
   `(Get-Content -Raw x.js) -replace … | Set-Content -Encoding utf8` 会**静默**写坏中文。
   用 `write` / `edit` 工具或 Python 读写。pre-commit 会查（`tools/check_encoding.mjs`）。
   事故记录：`docs/HANDOFF-2026-10-31.md:250`。
2. **截图一律加 `--compose`。**
   这台机器没有 GPU，Edge 与 headless shell 都走软件光栅，fixed 不透明浮层
   （`#panel`/`#topbar`…）下方会丢块，PNG 里是透明像素，**浏览器不报错**。
   换浏览器、换 `captureScreenshot` 参数都修不掉（`fromSurface:false` 会整页空白）。
3. **改完 `gdufs-3d/*.js` 先 `node --check`，再在真实页面上验一次。**
   语法错误的表现是整页白屏，越早发现越便宜。

## 常用命令

| 做什么 | 命令 |
| --- | --- |
| 起本地服务 | `python -m http.server 8080 --directory gdufs-3d`（或 `.\serve.ps1`） |
| 截图（含浮层合成） | `node tools/shot.mjs --compose --js "window.__navDebug.setPlaces('文采园','图书馆')" --out artifacts/3d/x.png` |
| 只看 3D 场景 | 同上加 `--nohud` |
| 界面体检（对比度 / 字号） | `node tools/lint_ui.mjs` —— 自带静态服务，桌面 + 手机两个视口 |
| 前端回归冒烟 | `node tools/smoke.mjs` —— 11 项，**改完前端必跑**；需要 8080 已起服务 |
| 编码检查 | `node tools/check_encoding.mjs`（`--staged` 只查暂存区） |
| 解码会话日志 | `node C:\Users\86134\.dsh\decodesession.mjs <session.v4.jsonl.zstd> --summary` |

## 目录导航

- `gdufs-3d/app.js` —— 场景、路网算路、交互。算路结果写进 `#status`（`setStatus`），
  距离另存一份到 `#status[data-dist]`，`mobile.js` 的收起态摘要读这个属性，不要改回正则从 HTML 抠数字。
- `gdufs-3d/mobile.js` —— 手机端收起态摘要与抽屉让位。
- `tools/` —— 全部脚本，Node 内置模块，无第三方依赖（`cdp.mjs` 是 CDP 驱动，`png.mjs` 是 PNG 编解码）。
- `docs/HANDOFF-*.md` —— 按日期累积的交接与踩坑记录，改数据或几何先读最近一份。

## 约定

- pre-commit 跑两件便宜的事：编码检查 + 暂存的 `*.js/*.mjs/*.cjs` 过 `node --check`。
  已设 `git config core.hooksPath tools/git-hooks`；临时绕过用 `git commit --no-verify`。
- 提交前如果新增了 hook 文件，记得 `git update-index --chmod=+x tools/git-hooks/pre-commit`。
- 界面类改动（CSS/HTML）除了冒烟，再跑一次 `node tools/lint_ui.mjs`：它拦的是
  「灰字压灰底」「字号塌到 8px」这类不报错的退化，输出里的 ⚠ 是提示、✗ 才是失败。
