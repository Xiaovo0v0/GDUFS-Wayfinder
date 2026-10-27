# 重新打包两个交付 zip：本地客户端包 + 交付包。
# 用法：powershell -ExecutionPolicy Bypass -File tools/pack_deliverables.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'gdufs-3d\dist'
$deliv = Join-Path $root 'deliverables'
$client = Join-Path $deliv 'local-client'

# 1) 客户端目录：用最新单文件覆盖
$html = Join-Path $dist '广外校园向导.html'
if (-not (Test-Path $html)) { throw "缺少单文件：$html" }
Copy-Item $html (Join-Path $client 'index.html') -Force
Copy-Item $html (Join-Path $client '尚行-广外校园向导.html') -Force
Copy-Item (Join-Path $deliv '架构图.png') (Join-Path $client '架构图.png') -Force

# 2) 客户端 zip
$zipClient = Join-Path $deliv '尚行-本地客户端.zip'
if (Test-Path $zipClient) { Remove-Item $zipClient -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($client, $zipClient, [System.IO.Compression.CompressionLevel]::Optimal, $false)

# 3) 交付包目录（临时）
$stageName = '尚行-GDUFS-Wayfinder'
$stage = Join-Path $env:TEMP ('pack-' + [guid]::NewGuid().ToString('N'))
$inner = Join-Path $stage $stageName
New-Item -ItemType Directory -Path $inner -Force | Out-Null
Copy-Item (Join-Path $deliv '交付说明.md') $inner -Force
Copy-Item (Join-Path $deliv '推文文案.md') $inner -Force
Copy-Item (Join-Path $deliv '广外校园向导-初赛设计方案.docx') $inner -Force
Copy-Item (Join-Path $deliv '架构图.png') $inner -Force
Copy-Item (Join-Path $deliv '海报.png') $inner -Force
Copy-Item (Join-Path $deliv '演示视频.mp4') $inner -Force
Copy-Item $zipClient $inner -Force

$zipAll = Join-Path $deliv '广外校园向导-交付包.zip'
if (Test-Path $zipAll) { Remove-Item $zipAll -Force }
[System.IO.Compression.ZipFile]::CreateFromDirectory($stage, $zipAll, [System.IO.Compression.CompressionLevel]::Optimal, $false)
Remove-Item $stage -Recurse -Force

function Show-Zip($p) {
  $len = (Get-Item $p).Length
  '{0}  {1:N2} MB' -f (Split-Path $p -Leaf), ($len / 1MB)
}
Show-Zip $zipClient
Show-Zip $zipAll
