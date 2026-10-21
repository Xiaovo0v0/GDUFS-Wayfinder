# Git 协作指南

> 给队友看的：仓库里放什么、不放什么、怎么改、怎么发版。

---

## 一、一句话原则

**代码、脚本、文档、小而必需的素材进仓库；密钥、构建产物、大体积成品不进。**

仓库当前约 **23 MB / 295 个文件**。

---

## 二、进仓库 / 不进仓库

### ✅ 进仓库

| 路径 | 说明 | 体积 |
|---|---|---|
| `gdufs-3d/` 源码 | `app.js`、`navigator-ui.js`、`i18n.js`、数据文件、`vendor/`、`assets/*.glb` | 3.7 MB |
| `tools/` | 全部脚本（169 个文件，含历史修补脚本） | 0.4 MB |
| `docs/` | 文档 | — |
| `skills/` | 技能 DSL 与 SKILL.md | 0.1 MB |
| `data/` | 官方原始资料（平面图、合格证 PDF、截图） | 18 MB |
| `artifacts/blender/` | 重建 GLB 的输入（轮廓 JSON + 立面贴图） | 0.1 MB |
| `deliverables/` 里的 DOCX / PNG / SVG / MD | 成品文档与图 | 4 MB |
| 根目录 `README.md`、`start.cmd`、`serve.ps1` | 入口 | — |

### ❌ 不进仓库（`.gitignore` 已覆盖）

| 路径 | 原因 | 替代获取方式 |
|---|---|---|
| `gdufs-3d/ai-config.local.js` | **含真实 Dify 密钥** | 向队长要 |
| `gdufs-3d/dist/` | 构建产物，且内嵌密钥 | 本地跑 `node tools/build_single_file.mjs` |
| `deliverables/local-client/*.html` | 同上，单文件网页内嵌密钥 | 同上 |
| `deliverables/*.mp4`、`deliverables/*.zip` | 18.6 MB 视频 + 24.5 MB 交付包，GitHub 不适合放大文件 | **GitHub Release**（见第五节） |
| `gdufs-south-campus/` | 早期整理版资料包，已被 `data/` 取代 | 历史提交里还在 |
| `.browser-profile/`、`tools/bin/`、`tools/dist/`、`artifacts/video/` | 缓存与可再生成的工具/中间帧 | 脚本自动重建 |
| `deliverables/team.json` | 团队个人信息（学号、手机号） | 各自本地填 |

> **密钥为什么不能进仓库**：`app-...` 是 Dify 的后端服务密钥，泄露后任何人都能调用我们的应用、消耗额度。仓库即使是私有，也不要养成提交密钥的习惯。

---

## 三、第一次拿到仓库

```bash
git clone <repo-url>
cd gdufs
mkdir -p gdufs-3d && echo "// 见 README「配置密钥」" > gdufs-3d/ai-config.local.js
# 按 README 把真实密钥填进 ai-config.local.js
python -m http.server 8080 --directory gdufs-3d
node tools/smoke.mjs        # 必须 10/10
```

---

## 四、日常协作

### 分支

| 分支 | 用途 |
|---|---|
| `main` | 随时可演示的状态，**必须能通过 `tools/smoke.mjs`** |
| `feat/xxx` | 单个功能（如 `feat/north-glb`） |
| `fix/xxx` | 修 bug |

### 提交前检查单

1. `node tools/smoke.mjs` → 10/10
2. 改过前端就 `node tools/build_single_file.mjs` 跑一次，确认能打包
3. `git status` 里没有 `ai-config.local.js`、`dist/`、`*.mp4`、`*.zip`
4. commit message 写清「改了什么 + 为什么」

### 改代码时最容易踩的坑

| 坑 | 说明 |
|---|---|
| **不要用 PowerShell 的 `Set-Content` 写中文源码** | 会写成 GBK 乱码；用编辑器或 `[System.IO.File]::WriteAllText(..., UTF8)` |
| 改 `app.js` / `navigator-ui.js` 后必须 `node --check` | 语法错误会让整页白屏 |
| 改 `skills/dsl/*.yml` 后要重新导入 Dify | `node tools/dify_import_skill.mjs <名字>` |
| 换 Dify 应用后要同步 `ai-config.local.js` | 否则前端调用的是旧应用 |
| 改了图/文档要重新打交付包 | 见 `docs/15-提交清单.md` |

---

## 五、发版（视频与交付包走 Release）

```bash
gh release create v1.0 \
  "deliverables/演示视频.mp4" \
  "deliverables/尚行-本地客户端.zip" \
  "deliverables/广外校园向导-交付包.zip" \
  --title "初赛提交版" --notes "见 docs/15-提交清单.md"
```

没有 `gh` 就在 GitHub 网页端 **Releases → Draft a new release** 手动上传这三个文件。

---

## 六、如果仓库变大想瘦身

`.git` 历史里还留着早期误提交的录屏帧（约 830 MB）。要彻底清理需重写历史：

```bash
pip install git-filter-repo
git filter-repo --path artifacts/video --path artifacts/3d --invert-paths
```

**代价**：所有提交哈希都会变，`docs/` 里引用的哈希会失效，队友必须重新 clone。
**建议**：除非仓库真的拖不动了，否则别做；日常只在 `main` 上追加提交即可。
