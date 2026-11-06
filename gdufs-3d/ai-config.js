// Dify 应用接入配置（模板，进仓库，不含密钥）
// 应用：尚行 · 广外校园向导（Chatflow：路由 + 导航/办事/百科 三专家）
// 密钥获取：Dify 控制台 → 应用 → 访问 API → 后端服务 API → API 密钥
//
// 真实密钥写在 ai-config.local.js（已在 .gitignore，不进仓库）。
// 那个文件在页面里紧跟本文件加载，由它自己把值覆盖进来；
// 没有这个文件时 key 为空，前端自动降级为本地规则问答（地图与办事功能不受影响）。
window.GDUFS_AI = {
  // 校内 Dify 已开域名（https）：同校内网 IP 172.17.1.46 一套后端，
  // 走 https 可避免公网页面调用 http 接口时的混合内容拦截。
  base: "https://dify.gdufs.edu.cn/v1",
  key: "",
  model: "",
  appId: "",
  timeout: 45000,
};
