# 尚行 · GDUFS Wayfinder

广外校园导航与办事指南 —— 3D 校园地图 + Dify 智能体，南北双校区、中英双语、断网可用。

> 仓库：<https://github.com/Xiaovo0v0/GDUFS-Wayfinder>　｜　参赛作品：广东外语外贸大学第二届 AI 应用创新大赛（初赛·生活服务）
> **接手项目先读 [`docs/HANDOFF-2026-11-01.md`](docs/HANDOFF-2026-11-01.md)** —— 现状、还差什么、关键决策都在那里；
> 2026-11-03 的推理服务故障复盘见 [`docs/HANDOFF-2026-11-03.md`](docs/HANDOFF-2026-11-03.md)（10-31、10-25 与 10-22 三版保留作历史对照）。

---

## 快速开始（30 秒）

```bash
# 起本地服务
python -m http.server 8080 --directory gdufs-3d
# 浏览器打开
http://127.0.0.1:8080/
```

`?campus=north` 切北校区，`?lang=en` 切英文，`?ai=off` 强制离线，`?ll=23.06829,113.3946,15` 在没有 GPS 的电脑上模拟一次定位。

**先跑一遍自检，确认环境没问题：**

```bash
node tools/smoke.mjs                  # 前端冒烟（11~12 项，配了 ai-config 时多一项 AI 问答）
node tools/verify_local_client.mjs    # 安装包验收 5 项
```

---

## 配置密钥（进团队后第一件事）

仓库里**没有密钥**。`gdufs-3d/ai-config.js` 是空模板，真实密钥放在同目录的 `ai-config.local.js`（已 gitignore）：

```js
// gdufs-3d/ai-config.local.js
window.GDUFS_AI = window.GDUFS_AI || {};
window.GDUFS_AI_LOCAL = {
  key: "app-...",        // 向队长要
  appId: "...",
  model: "DeepSeek-V4-Flash-0731",
};
["key", "appId", "model", "base", "timeout"].forEach(function (k) {
  var v = window.GDUFS_AI_LOCAL[k];
  if (v != null && v !== "") window.GDUFS_AI[k] = v;
});
```

没有这个文件也能跑：地图、路线、漫游、办事卡片全部正常，只有对话降级成规则匹配。

---

## 目录结构

| 目录 | 内容 |
|---|---|
| `gdufs-3d/` | 3D 前端源码（Three.js，无构建步骤） |
| `tools/` | 生成与验证脚本（Python + Node） |
| `docs/` | 文档；`HANDOFF-2026-11-01.md` 是入口，`15-提交清单` 是交付清单；`GEO-LOCK-2026-11-01.md` 是两校区坐标，`BUILDINGS-2026-11-01.md` 是楼名名录 |
| `skills/` | 4 个技能的定义（Dify DSL 与 SKILL.md） |
| `data/` | 官方原始资料（平面图矢量化、办事数据源） |
| `artifacts/blender/` | 重建 3D 模型所需的输入 |
| `deliverables/` | 成品（DOCX / 图表 / 说明）；视频与打包 zip 走 Release |

---

## 源码与佐证（给评审）

本仓库即初赛「完整源码 / 佐证材料」提交物：3D 前端、Dify 智能体编排（`skills/` 的 DSL 与 SKILL.md）、
生成与验收脚本（`tools/`）、官方原始资料（`data/`）、过程记录（`docs/`）全在其中。
成品文档与打包在 `deliverables/`，演示视频与 zip 因体积走 GitHub Release。

**从源码复现（无需构建工具、无 npm 依赖）**

```bash
python -m http.server 8080 --directory gdufs-3d   # 1) 起服务，打开 http://127.0.0.1:8080/
node tools/build_single_file.mjs                  # 2) 生成单文件网页（约 2.7 MB）
node tools/smoke.mjs                              # 3) 自检 11 项（需 8080 已起）
node tools/verify_local_client.mjs                # 4) 安装包验收 5 项
```

**原创与可复核**

- 提交历史按时间记录每一次建模、算路、办事数据与界面改动（意图路由、动作契约、断网降级的迭代都在里面）
- `data/official/` 是学校官方平面图与建设工程规划验收合格证原件；`tools/` 里的矢量化、Blender 建模、
  截图脚本可复核每一步产物的来源
- `docs/` 记录决策与故障复盘（例如 2026-11-03 推理服务故障的完整证据链），根目录的调研报告为选题依据

---

## 常用命令

| 命令 | 作用 |
|---|---|
| `node tools/build_single_file.mjs` | 打包成单文件网页（内联 GLB 与两校数据，约 2.7 MB） |
| `node tools/mobile_check.mjs` | 手机端适配验收（多尺寸/多状态截图 + 布局断言：收起/展开、算路、建筑卡、语心、漫游） |
| `node tools/check_locate.mjs [--file]` | 定位「我的位置」验收 17 项（CDP 伪 GPS，含 file:// 双击场景） |
| `node tools/shot.mjs --url ... --out ...` | 截图（加 `--mobile --w 430 --h 932` 可手机模拟） |
| `node tools/verify_local_client.mjs` | 交货前必跑 |
| `python tools/fill_design_docx.py` | 重新生成设计方案 DOCX |
| `python tools/fill_team.py --team ...` | 填团队信息并重生成 DOCX |
| `node tools/dify_switch_model.mjs <模型>` | 换模型并重建应用 |

---

## 协作约定

- 提交前跑 `node tools/smoke.mjs`，必须 11/11
- **不要把密钥、`dist/`、视频、打包 zip 提交进仓库**（已在 `.gitignore`）
- 详细的分工与发布流程见 [`docs/18-Git协作指南.md`](docs/18-Git协作指南.md)

---

## 数据来源

11 个院部官网的一手页面、广州市建设工程规划验收合格证、学校官方北校区平面图 b.jpg（400 米跑道标定 0.4178 米/像素）、OpenStreetMap 与 Overture（南校区轮廓与路网）。每条办事数据都记录了来源与置信度，官网未公布的明确标「官网未公布」。
