# 交接文档　尚行 · GDUFS Wayfinder

> 最后更新：2026-10-22　｜　对应提交：`65c1754`
> 读者：接手这个项目的人（或下一个 AI 助手）。
> 一句话现状：**作品本身已完工并逐项验证，初赛材料齐全；只差「团队信息」「收集表」「周五换模型」三件需要人操作的事。**

---

## 一、30 秒确认它还活着

```bash
node tools/verify_local_client.mjs    # 期望：✅ 全部通过（5 项）
node tools/smoke.mjs                  # 期望：10/10 通过
```

不想跑命令：解压 `deliverables/尚行-本地客户端.zip`，双击 `index.html`，能看到 3D 校园并转动，就说明没坏。

---

## 二、还差的三件事（做完就能交）

### ① 团队信息 —— 卡住提交的唯一原因

```bash
python tools/fill_team.py --team "队名" --leader "姓名|院系|学号|手机|邮箱" \
  --member "姓名|院系|学号|手机|邮箱"
```

**完成判据**：重新生成的 `deliverables/广外校园向导-初赛设计方案.docx` 第 1 页，团队名称不再是「（待填写）」，负责人那行有 5 项内容。
信息存在 `deliverables/team.json`（已 gitignore，不进仓库）。

### ② 初赛信息收集表

文案在 `docs/14-收集表填写草稿.md`，「预期成果形式」填【本地客户端应用】那段，直接复制。

**完成判据**：表单提交成功，有回执或截图。

### ③ 周五晚换模型（2026-10-24 之后）

DeepSeek-V4-Flash 与 GLM-5.2 停服，学校新上线 `DeepSeek-V4.1-Flash-1017-w8a8`。

1. Dify 界面加模型：`http://172.17.1.46/integrations/model-provider` → OpenAI-API-compatible → **添加模型**
   - 模型名称 `DeepSeek-V4.1-Flash-1017-w8a8`、类型 `LLM`
   - API Key：学校发的 `sk-...`（控制台里存的是加密值，读不出明文，必须重填一次）
   - Base URL `https://modelsq.gdufs.edu.cn/v1-openai`
2. 切应用：`node tools/dify_switch_model.mjs DeepSeek-V4.1-Flash-1017-w8a8`
3. 同步文档里的模型名：`GDUFS_MODEL_DOC="DeepSeek-V4.1-Flash-1017-w8a8" python tools/fill_design_docx.py`
4. 重新打包（见第五节）

**完成判据**：问「正门怎么去图书馆」，4–10 秒内返回 `{"intent":"navigate", ... "distance":452 ...}`。

**加不上模型也不影响交货**：前端会自动降级为本地规则，仍能给出完整的部门/地点/时段/材料（已实测，见 `docs/17`）。退路是切 `Qwen3.8-27B`：能用，慢 3–5 倍。

---

## 三、目录地图

| 路径 | 是什么 | 动之前想清楚 |
|---|---|---|
| `deliverables/` | **最终交付物**（DOCX、安装包、视频、物料、交付包） | 改完任何源文件都要重新打包，见第五节 |
| `gdufs-3d/` | 3D 前端源码（`app.js` 1680 行、`navigator-ui.js`、`i18n.js`、数据文件） | 主力代码区 |
| `gdufs-3d/dist/` | 打包好的单文件网页（2.17 MB，内联两份 GLB） | 由脚本生成，不要手改 |
| `skills/` | 4 个技能的 DSL（`dsl/*.yml`）与 SKILL.md | 改完要重新导入 Dify |
| `tools/` | 生成与验证脚本（见第六节） | — |
| `docs/` | 过程文档；**`docs/13` 换模型、`docs/14` 收集表、`docs/15` 提交清单、`docs/17` 审计** | 这几份是当前有效的 |
| `data/` | 官方原始资料（北校平面图矢量化结果、办事数据源） | 数据的源头，别删 |
| `artifacts/blender/` | 重建 GLB 的输入（`buildings.json`、`north_buildings.json`、5 张立面贴图） | 唯一保留的中间产物，因为删了就没法重建模型 |
| `gdufs-south-campus/` | 早期整理版的资料包，已被当前结构取代 | 可选删除；`docs/` 里还有 6 处引用它 |

---

## 四、关键决策（**别轻易推翻**）

| 决策 | 理由 |
|---|---|
| **动作契约**：模型只输出 `{intent, from, to, answer, card}` JSON，渲染由前端做 | 避免「AI 说往东走、地图纹丝不动」；也让同一套智能体可被网页/小程序复用 |
| **双通道降级**：Dify 连不上就切本地规则（40 条 FAQ + 地名匹配） | 保证任何网络环境都能演示；周五模型下线也不会让作品不可用 |
| **交付形态选「本地客户端应用」** | 172.17.1.46 是校内私有地址，评委在校外打不开；填「在线演示地址」等于给个打不开的链接 |
| **南北校区用同一套 Blender 管线** | 两套建模逻辑必然漂移；现在 `blender_build.py` 用环境变量区分输入输出 |
| **技能做成 Dify workflow 而不是 Agent 节点** | workflow 有明确 I/O 契约、可单独发布为工具、跑得稳；Agent 节点是 BETA |
| **办事分支里塞结构化代码节点** | 材料/时段这类事实让代码算，让 LLM 只负责组织语言，避免它自由发挥 |

---

## 五、改完东西怎么重新打包

```bash
node tools/build_single_file.mjs          # 重打单文件（只改前端时）
python tools/fill_design_docx.py          # 重生成 DOCX（改文案/图时）
python tools/encode_video.py              # 重编视频（需要录屏帧，见下）
```

打交付包（10 个文件 → `deliverables/广外校园向导-交付包.zip`）用 `docs/15` 里列的那批文件，PowerShell 一行 `Compress-Archive` 即可。

> 视频重编需要先录屏：`node tools/record.mjs --url "http://127.0.0.1:8080/?lang=zh" --out artifacts/video/seg_main --seg main`。
> 录屏帧已在清理中删除（1.2 GB），要改视频就得重新录。

---

## 六、常用命令

| 命令 | 作用 |
|---|---|
| `node tools/smoke.mjs` | 前端冒烟 10 项 |
| `node tools/verify_local_client.mjs` | 解压安装包 → file:// 打开 → 5 项验收 |
| `node tools/check_fallback.mjs` | 拦截 Dify，验证降级 |
| `node tools/check_paths.mjs` | 中文/空格路径兼容 |
| `node tools/check_online_from_file.mjs` | 双击（file://）能否连智能体 |
| `node tools/shot.mjs --url ... --out ...` | 截图（改 UI 后对照用） |
| `node tools/dify_list_apps.mjs` | 列出 Dify 上的应用 |
| `node tools/dify_switch_model.mjs <模型>` | 一键换模型并重建 |
| `node tools/verify_local_client.mjs` | 交货前必跑 |

启动本地服务：`.\start.cmd`（或 `python -m http.server 8080 --directory gdufs-3d`）。

---

## 七、账号与地址

- Dify 控制台：`http://172.17.1.46`　账号 `20241003008@gdufs.edu.cn`
- 主应用 WebApp：`http://172.17.1.46/chat/uJIqVGKRsnkz7GY8`
- 5 个应用清单（含 4 个技能链接）：`docs/11-Dify应用清单.md`
- 前端调用的 App ID 与密钥：`gdufs-3d/ai-config.js`（换应用后这里必须同步）

---

## 八、已知问题（以及为什么不修）

| 问题 | 原因 | 处理 |
|---|---|---|
| LibreOffice 打开是 7 页（Word 是 6 页） | 缺「微软雅黑」，字形更宽把「应用形态」挤到第 2 页 | 不修：内容与复选框都正常，文档无页数上限 |
| 北校屋面偏亮 | 天光+平行光把水平面照得亮，材质增益有限（调到 0x3f464c 也只暗 8%） | 已停在合理区间，不再追 |
| `.git` 有 830 MB | 早期误把录屏帧与截图提交进历史 | 工作区已清理；**要彻底瘦身需重写历史**（`git filter-repo`），会让所有提交哈希变化，`docs/` 里引用的哈希随之失效，需你确认后再做 |
| 无公网部署 | 学校服务器只在内网 | 靠「本地客户端应用」这条交付路径覆盖 |
| 北校建筑体量比南校简单 | 官方平面图轮廓点更少 | 数据本身的精度限制 |

---

## 九、如果要重建 3D 模型

Blender 便携包已在清理中删除，重建需先拿回来：

```bash
# 1) 下载并解压（约 380 MB）
curl -L -o tools/dist/blender.zip https://download.blender.org/release/Blender4.5/blender-4.5.10-windows-x64.zip
# 2) 解压到 tools/bin/（目录名以压缩包内为准）
# 3) 生成南校 / 北校 GLB
GDUFS_SRC=artifacts/blender/buildings.json GDUFS_NAME=gdufs_buildings.glb \
  tools/bin/blender-4.5.10-windows-x64/blender.exe --background --python tools/blender_build.py
python tools/prep_north_glb.py
GDUFS_SRC=artifacts/blender/north_buildings.json GDUFS_NAME=north_buildings.glb \
  tools/bin/blender-4.5.10-windows-x64/blender.exe --background --python tools/blender_build.py
node tools/build_single_file.mjs
```

视频编码还需要 ffmpeg：`pip install imageio-ffmpeg`，把 `ffmpeg.exe` 拷到 `tools/bin/`。
