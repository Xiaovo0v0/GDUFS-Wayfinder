// Dify 应用接入配置
// 应用：尚行 · 广外校园向导（Chatflow：路由 + 导航/办事/百科 三专家）
// 控制台：http://172.17.1.46/app/6260e36f-d3c6-42b4-b78b-4e11f22b82f4/workflow
// 密钥：Dify 控制台 → 访问 API → 后端服务 API → API 密钥
// 说明：这是 WebApp 级密钥，只能调用本应用。换模型可跑
//       node tools/dify_switch_model.mjs <模型名>，脚本会自动改写本文件并重打单文件。
window.GDUFS_AI = {
  base: "http://172.17.1.46/v1",
  key: "app-Mr7iOV4sQhqmOvP3hju8IXff",
  model: "DeepSeek-V4-Flash-0731",
  appId: "6260e36f-d3c6-42b4-b78b-4e11f22b82f4",
  timeout: 45000,
};
