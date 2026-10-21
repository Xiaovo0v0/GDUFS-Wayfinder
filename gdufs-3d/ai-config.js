// Dify 应用接入配置
// 应用：尚行 · 广外校园向导（Chatflow：路由 + 导航/办事/百科 三专家）
// 控制台：http://172.17.1.46/app/80f06e29-0a32-40c1-971d-a91ab198af12/workflow
// 密钥：Dify 控制台 → 访问 API → 后端服务 API → API 密钥
// 说明：这是 WebApp 级密钥，只能调用本应用。换模型可跑
//       node tools/dify_switch_model.mjs <模型名>，脚本会自动改写本文件并重打单文件。
window.GDUFS_AI = {
  base: "http://172.17.1.46/v1",
  key: "app-bNUA0eExnRsNEj2sS8b7EDFf",
  model: "DeepSeek-V4-Flash-0731",
  appId: "80f06e29-0a32-40c1-971d-a91ab198af12",
  timeout: 45000,
};
