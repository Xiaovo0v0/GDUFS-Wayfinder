# AGENTS.md

给在这个仓库里干活的 agent（也给我自己）。只写**不读就会踩坑**的东西；
项目背景、数据来源、历史决策都在 `docs/`，不要往这里抄。

产品：`gdufs-3d/` —— 广外校园导航，Three.js r128，**无构建、无 npm 依赖**，
`index.html` + 一组 `*.js`，双击 `start.cmd` 或 `serve.ps1` 就能跑。

> 2026-11-06 起 `tools/`（截图、冒烟、建模、打包脚本）已按提交要求移除，仓库只留产品源码、
> 数据、文档与成品。改完前端请在浏览器里手动过一遍：首页 → 算路 → 建筑卡 → 漫游 → `?lang=en`。

## 三条硬规则

1. **含中文的文件不许过 PowerShell 管道。**
   本机默认 shell 是 PowerShell 5.1，按 GBK 读无 BOM 的 UTF-8：
   `(Get-Content -Raw x.js) -replace … | Set-Content -Encoding utf8` 会**静默**写坏中文。
   用 `write` / `edit` 工具或 Python 读写。
   事故记录：`docs/HANDOFF-2026-10-31.md:250`。
2. **截图一律「截图 + 纯场景合成」两张再叠。**
   这台机器没有 GPU，Edge 与 headless shell 都走软件光栅，fixed 不透明浮层
   （`#panel`/`#topbar`…）下方会丢块，PNG 里是透明像素，**浏览器不报错**；
   `fromSurface:false` 会整页空白。没有现成脚本时，用 CDP 截两次再按 alpha 合成。
3. **改完 `gdufs-3d/*.js` 先 `node --check`，再在真实页面上验一次。**
   语法错误的表现是整页白屏，越早发现越便宜。

## 常用命令

| 做什么 | 命令 |
| --- | --- |
| 起本地服务 | `python -m http.server 8080 --directory gdufs-3d`（或 `.\serve.ps1`） |
| 语法检查 | `node --check gdufs-3d/app.js` |
| 解码会话日志 | `node C:\Users\86134\.dsh\decodesession.mjs <session.v4.jsonl.zstd> --summary` |

## 目录导航

- `gdufs-3d/app.js` —— 场景、路网算路、交互。算路结果写进 `#status`（`setStatus`），
  距离另存一份到 `#status[data-dist]`，`mobile.js` 的收起态摘要读这个属性，不要改回正则从 HTML 抠数字。
- `gdufs-3d/mobile.js` —— 手机端收起态摘要与抽屉让位。
- `gdufs-3d/ai-config.js` —— 接口地址模板；真实密钥在 `ai-config.local.js`（gitignore，不进仓库）。
- `docs/HANDOFF-*.md` —— 按日期累积的交接与踩坑记录，改数据或几何先读最近一份。

## 约定

- **不要把密钥、`dist/`、视频、打包 zip 提交进仓库**（已在 `.gitignore`）。
- 提交前手动过一遍页面；没有再跑自动化冒烟的条件了，肉眼验收比"看起来能提交"可靠。
