# 一键启动本地预览（双击右键「使用 PowerShell 运行」）
# 说明：GLB 模型必须通过 http 打开，直接双击 index.html 会退回程序化几何。
$port = 8765
$root = Split-Path -Parent $PSScriptRoot
$url = "http://127.0.0.1:$port/gdufs-3d/index.html"

Write-Host "启动本地服务器：$root" -ForegroundColor Cyan
Write-Host "打开：$url" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止。" -ForegroundColor DarkGray

Start-Process $url
# 兼容没有 python 别名、只有 py 启动器的机器
if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -m http.server $port --bind 127.0.0.1 --directory $root
} else {
    & python -m http.server $port --bind 127.0.0.1 --directory $root
}
