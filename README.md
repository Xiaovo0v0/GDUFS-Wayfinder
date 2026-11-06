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

只想看成品：直接双击 `deliverables/尚行-广外校园向导.html`（单文件，含全部数据，不需要服务器）。

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
| `docs/` | 文档；`HANDOFF-2026-11-01.md` 是入口，`15-提交清单` 是交付清单；`GEO-LOCK-2026-11-01.md` 是两校区坐标，`BUILDINGS-2026-11-01.md` 是楼名名录 |
| `skills/` | 4 个技能的定义（Dify DSL 与 SKILL.md） |
| `data/` | 官方原始资料（平面图矢量化、办事数据源） |
| `artifacts/blender/` | 重建 3D 模型所需的输入 |
| `deliverables/` | 成品（DOCX / 图表 / 说明）；视频与打包 zip 走 Release |

---

## 源码与佐证（给评审）

本仓库即初赛「完整源码 / 佐证材料」提交物：3D 前端、Dify 智能体编排（`skills/` 的 DSL 与 SKILL.md）、
官方原始资料（`data/`）、过程记录（`docs/`）全在其中。成品文档与打包在 `deliverables/`，
演示视频与 zip 因体积走 GitHub Release。

**打开即用（无需构建工具、无 npm 依赖）**

- 双击 `deliverables/尚行-广外校园向导.html`：单文件网页，3D 模型、路网、办事数据全部内联，断网可用
- 或 `python -m http.server 8080 --directory gdufs-3d` 后打开 `http://127.0.0.1:8080/`（改源码时用这个）
- 任何静态托管都能直接放 `gdufs-3d/`；在线智能体入口 <https://dify.gdufs.edu.cn/chat/uJIqVGKRsnkz7GY8>

**原创与可复核**

- 提交历史按时间记录每一次建模、算路、办事数据与界面改动（意图路由、动作契约、断网降级的迭代都在里面）
- `data/official/` 是学校官方平面图与建设工程规划验收合格证原件，每条办事数据在 `data/service_guide/` 里带来源与置信度
- `docs/` 记录决策与故障复盘（例如 2026-11-03 推理服务故障的完整证据链），根目录的调研报告为选题依据

---

## 协作约定

- **不要把密钥、`dist/`、视频、打包 zip 提交进仓库**（已在 `.gitignore`）
- 详细的分工与发布流程见 [`docs/18-Git协作指南.md`](docs/18-Git协作指南.md)

---

## 数据来源

11 个院部官网的一手页面、广州市建设工程规划验收合格证、学校官方北校区平面图 b.jpg（400 米跑道标定 0.4178 米/像素）、OpenStreetMap 与 Overture（南校区轮廓与路网）。每条办事数据都记录了来源与置信度，官网未公布的明确标「官网未公布」。
