# nav-design/ —— 一次性设计探索产物（第 1 轮）

2026-11-01 的「探索更好的设计语言」那一轮留下的东西。**不是产品代码，不参与构建**，
整个目录被 `.gitignore` 排除（`*`），也不会进交付包。

用户当时从中选了一屏（02 B 图纸 · 桌面），已经落进 `gdufs-3d/`。
这里是留档，不是待办。

## 目录里是什么

| 路径 | 内容 | 还需要吗 |
| --- | --- | --- |
| `style-explorer.html` | 13.9 MB 的同屏对比页（三方向 × 桌面/手机，内嵌全部本地资源）。当时就是看这个做决定的 | 留档 |
| `manifest.json` | 对比页的清单：每个方向的名称、概念、配色、字体、特征 | 留档 |
| `explore/` | 6 个候选单页（a/b/c × 桌面/手机），可单独打开 | 留档 |
| `shots/` | 132 MB 评审截图（中间过程 + 实现后对照） | 留档，别当资产用 |
| `assets/` | 底图、字体等被对比页引用过的素材 | 留档 |

## 唯一被产品化的部分已经搬走

这个目录里原来有一套管用的**分层合成截图管线**：

- `cap.mjs` —— 截两张（整页 / 藏掉浮层的纯场景）再用 `destination-over` 合成
- `compose.html` + `serve.cjs` —— 在浏览器里做合成，需要另起一个 8099 端口的静态服务

它现在在正确的位置，不需要浏览器、不需要第二个服务：

- `tools/cdp.mjs` → `Browser#shotClean(file, { hide })`
- `tools/shot.mjs --compose`
- `tools/png.mjs` —— Node 侧的 PNG 编解码与 `composeOver()`

原始的 `cap.mjs` / `compose.html` / `serve.cjs` 已删除（2026-11-01），避免同一件事
两个实现。顺手纠正了当时写错的原因：丢块不是「headless shell 的合成器」的锅，
**任何软件渲染器**（这台机器没有 GPU，Edge 和 headless shell 都走 SwiftShader /
Basic Render Driver）在 fixed 不透明浮层下方都会丢。

需要重新截图或验证，去 `tools/`，不要往这个目录加新代码。
