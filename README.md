# 尚行 · GDUFS Wayfinder

广外校园导航与办事指南 —— 3D 校园地图 + Dify 智能体，南北双校区、中英双语、断网可用。

> 参赛作品：广东外语外贸大学第二届 AI 应用创新大赛（初赛·生活服务）
> **接手项目先读 [`docs/HANDOFF.md`](docs/HANDOFF.md)** —— 现状、还差什么、关键决策都在那里。

---

## 快速开始（30 秒）

```bash
# 起本地服务
python -m http.server 8080 --directory gdufs-3d
# 浏览器打开
http://127.0.0.1:8080/
```

`?campus=north` 切北校区，`?lang=en` 切英文，`?ai=off` 强制离线。

**先跑一遍自检，确认环境没问题：**

```bash
node tools/smoke.mjs                  # 前端冒烟 10 项
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
| `docs/` | 文档；`HANDOFF.md` 是入口，`15-提交清单` 是交付清单 |
| `skills/` | 4 个技能的定义（Dify DSL 与 SKILL.md） |
| `data/` | 官方原始资料（平面图矢量化、办事数据源） |
| `artifacts/blender/` | 重建 3D 模型所需的输入 |
| `deliverables/` | 成品（DOCX / 图表 / 说明）；视频与打包 zip 走 Release |

---

## 常用命令

| 命令 | 作用 |
|---|---|
| `node tools/build_single_file.mjs` | 打包成单文件网页（内联 GLB，约 2.2 MB） |
| `node tools/shot.mjs --url ... --out ...` | 截图 |
| `node tools/verify_local_client.mjs` | 交货前必跑 |
| `python tools/fill_design_docx.py` | 重新生成设计方案 DOCX |
| `python tools/fill_team.py --team ...` | 填团队信息并重生成 DOCX |
| `node tools/dify_switch_model.mjs <模型>` | 换模型并重建应用 |

---

## 协作约定

- 提交前跑 `node tools/smoke.mjs`，必须 10/10
- **不要把密钥、`dist/`、视频、打包 zip 提交进仓库**（已在 `.gitignore`）
- 详细的分工与发布流程见 [`docs/18-Git协作指南.md`](docs/18-Git协作指南.md)

---

## 数据来源

11 个院部官网的一手页面、广州市建设工程规划验收合格证、学校官方平面图（北校区，400 米跑道标定 0.4178 米/像素）、OpenStreetMap 与 Overture（南校区轮廓与路网）。每条办事数据都记录了来源与置信度，官网未公布的明确标「官网未公布」。
