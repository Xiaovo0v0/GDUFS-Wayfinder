# Blender LOD2 建模流程（可复现）

> 目的：把「OSM 轮廓 + 官方层数」变成可复用的专业模型资产（GLB），而不是只在前端临时画盒子。
> 环境：Windows + Blender 4.5 LTS（`winget install BlenderFoundation.Blender.LTS.4.5`）
> 产物：`gdufs-3d/assets/gdufs_buildings.glb`（51 栋，435 KB，含立面贴图）

---

## 1. 为什么要多这一步

前端 Three.js 里也能挤出体块，但有三件事只有建模软件能做好：

| 需求 | Three.js 程序化 | Blender |
|---|---|---|
| 女儿墙 / 雨棚 / 屋顶设备 | 要手写几何，代码越堆越长 | 直接建，且能继续手改 |
| 法线、UV、材质槽 | 要自己保证 | `recalc_face_normals` + UV 层，导出器兜底 |
| 交付物 | 只能在线看 | **GLB** 可给任何引擎/评委/后续同学复用 |
| 后续精修 | 改代码 | 打开 .blend 手推点 |

所以定位是：**Blender 出资产，Three.js 做交互**。前端仍然保留程序化几何作为兜底（双击 `index.html`、没有服务器时自动降级）。

---

## 2. 数据流

```
gdufs-3d/gdufs-data.js          （已投影的局部米制坐标，x=西正、z=北、y=高）
        │  tools/export_for_blender.mjs
        ▼
artifacts/blender/buildings.json  （51 栋 + 类型调色板）
        │  tools/make_facade_textures.py  （PIL 生成 5 种立面贴图，1 tile = 3.6m×3.6m）
        ▼
artifacts/blender/tex/*.png
        │  tools/blender_build.py  （headless: blender --background --python）
        ▼
gdufs-3d/assets/gdufs_buildings.glb
        │  vendor/GLTFLoader.js
        ▼
gdufs-3d/app.js  → 加载成功则替换程序化建筑，失败则保留
```

一条命令重建：

```powershell
node tools/export_for_blender.mjs
python tools/make_facade_textures.py
& "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe" --background --python tools/blender_build.py
```

---

## 3. 建模规则（脚本里都实现了）

| 部位 | 做法 | 依据 |
|---|---|---|
| 体块 | 轮廓多边形挤出到 `height`，逐边生成墙四边形 | OSM/Overture 足迹 + 规划验收层数 |
| 立面 UV | 沿周长累计长度 / 3.6 m 作 u，高度 / 3.6 m 作 v | 与真实开间、层高对齐，窗格不会拉伸 |
| 立面贴图 | 5 种：ribbon（教学/实验）、punch（宿舍）、curtain（图书馆）、large（食堂）、panel（体育馆） | 官方照片 `g_building.jpg`、`g_lbnight.jpg` |
| 屋顶 | 顶面封盖 + 0.9 m 女儿墙（外扩 0.2 m） | 官方修缮公告「天面层防水」「平屋顶」 |
| 屋顶设备 | 面积 > 1200 ㎡ 的建筑按 id 哈希生成 2–4 个箱体 | 照片可见空调机组/水箱 |
| 入口雨棚 | 在 `access` 点找最近环边，沿切线 9 m × 法线 4.4 m，标高 3.7–4.1 m | 官方「首层各个出入口位置设置雨棚」 |
| 法线 | `bmesh.ops.recalc_face_normals` 统一朝外 | — |
| 坐标 | Blender 顶点存 `(x, -z, h)`，导出 `+Y up` → glTF 得到 `(x, h, z)`，与前端坐标系一致 | — |
| 颜色 | 纯色材质做 `sRGB → Linear`（`(c/255)^2.2`） | 否则 GLB 里屋顶会白成一片 |

---

## 4. 前端接入

`app.js` 里新增了 `6.5` 段：

```js
new THREE.GLTFLoader().load("assets/gdufs_buildings.glb", gltf => {
  // 用正则从 mesh_B001 / B001 里取出建筑 id，挂 userData.building
  scene.remove(procedural);   // 移除程序化几何
  scene.add(gltf.scene);      // 用 GLB 替换
  buildingMeshes = [...];     // 射线拾取仍然可用
}, undefined, () => { /* 失败则保持 procedural */ });
```

- **一定要用 http 打开**：`file://` 下浏览器会拦截 GLB 的 fetch，自动回落程序化几何。
  本地预览：`python -m http.server 8765`，然后访问 `http://127.0.0.1:8765/gdufs-3d/index.html`。
- 点击建筑选址、下拉框算路、隧道判定等逻辑不受影响（已验证：文采园 → 图书馆 820 m / 27 路点）。

---

## 5. 和 MCP / SKILL 的关系

- 交互式精修可以用 [mcp-for-blender](https://github.com/ahujasid/blender-mcp)（原 `blender-mcp`）：
  `uvx mcp-for-blender install-addon` 装 Blender 插件，MCP 客户端里配 `uvx mcp-for-blender`，
  之后可以用自然语言让 AI 在 Blender 里改模型（它有 `look` 工具能自己看渲染结果）。
- 本仓库的 `tools/blender_build.py` 是**无人值守**版本：适合批量重建、进 CI，不依赖 MCP。
  两者互补：脚本负责"从数据到体块"，MCP 负责"人工/AI 精修重点建筑"。

---

## 6. 下一步可做

1. **重点建筑单独精修**：图书馆（玻璃幕墙分格、入口大台阶）、大会堂（2 层连体）、体育馆（金属屋面弧线），用 MCP 在 Blender 里手动做，再导出为 `landmarks.glb` 叠加。
2. **烘焙 AO**：Cycles 烘一张环境光遮蔽贴图，能让体块立刻"有体积感"。
3. **钟楼**：官方确认是南校区名片（方形塔、红褐+米白面砖、四面圆钟面、平顶栏杆），但位置未确认，待官方平面图配准后补。
