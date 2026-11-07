# Windows 免安装启动器

`启动尚行.cmd` 调用 Windows 自带的 PowerShell 运行 `server.ps1`，仅监听本机地址，自动选择 8080–8179 中可用端口并打开默认浏览器。无需 Python、Git 或管理员权限。

发行目录应为：

```text
Wayfinder-Windows/
├── 启动尚行.cmd
├── server.ps1
├── 使用说明.txt
└── app/
    ├── index.html
    ├── *.js / *.css
    ├── assets/
    └── vendor/
```

`app/` 使用 `gdufs-3d/` 的运行文件，保留资源相对路径。服务器脚本必须保存为带 BOM 的 UTF-8，兼容 Windows PowerShell 5.1。打包时排除备份、调试页面和历史产物。

本目录仅保存不含密钥的启动器源文件。评委专用 ZIP 附带本地 Dify 应用配置，定向提供，不提交到公开仓库。完整在线问答需要连接并登录广外校园网；地图、路径和本地资料可独立运行。
