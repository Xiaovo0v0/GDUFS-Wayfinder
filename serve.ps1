# 尚行 · 广外校园向导 —— 一键起内网服务
#
#   .\serve.ps1              开发版：服务 gdufs-3d/（GLB 走 http 才会加载）
#   .\serve.ps1 -Dist        成品版：服务 deliverables/（单文件网页 + 架构图）
#   .\serve.ps1 -Port 8080   指定端口
#
# 作用：
#   1) 打印本机所有内网地址，评委/同学在校园网内可直接打开
#   2) 阻止系统休眠（服务期间有效，退出即恢复）
#   3) 检查端口是否已被占用

param(
    [int]$Port = 8080,
    [switch]$Dist
)

$ErrorActionPreference = 'Stop'
$repo = $PSScriptRoot
$root = if ($Dist) { Join-Path $repo 'deliverables' } else { Join-Path $repo 'gdufs-3d' }

if (-not (Test-Path (Join-Path $root 'index.html')) -and -not (Test-Path (Join-Path $root '尚行-广外校园向导.html'))) {
    Write-Host "找不到入口文件：$root" -ForegroundColor Red
    exit 1
}

# ---------- 阻止休眠（无需管理员） ----------
$sig = @'
using System;
using System.Runtime.InteropServices;
public class SleepGuard {
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint esFlags);
    public const uint ES_CONTINUOUS       = 0x80000000;
    public const uint ES_SYSTEM_REQUIRED  = 0x00000001;
    public const uint ES_DISPLAY_REQUIRED = 0x00000002;
    public static void Hold()  { SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED); }
    public static void Release() { SetThreadExecutionState(ES_CONTINUOUS); }
}
'@
try {
    Add-Type -TypeDefinition $sig -ErrorAction Stop
    [SleepGuard]::Hold()
    $sleepGuard = $true
} catch {
    $sleepGuard = $false
}

# ---------- 端口占用检查 ----------
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    $proc = (Get-Process -Id $busy[0].OwningProcess -ErrorAction SilentlyContinue).ProcessName
    Write-Host "端口 $Port 已被占用（$proc），换一个：.\serve.ps1 -Port 8081" -ForegroundColor Red
    if ($sleepGuard) { [SleepGuard]::Release() }
    exit 1
}

# ---------- 收集内网地址 ----------
$addrs = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
        $_.IPAddress -notlike '127.*' -and
        $_.IPAddress -notlike '169.254.*' -and
        $_.PrefixOrigin -ne 'WellKnown'
    } |
    Sort-Object -Property @{ Expression = { $_.InterfaceAlias -like '*VMnet*' -or $_.InterfaceAlias -like '*vEthernet*' } }

Write-Host ''
Write-Host '  尚行 · 广外校园向导' -ForegroundColor Cyan
Write-Host "  服务目录：$root" -ForegroundColor DarkGray
Write-Host "  端口：$Port" -ForegroundColor DarkGray
Write-Host ''
Write-Host '  在【连校园网】的手机或电脑上打开：' -ForegroundColor Yellow
foreach ($a in $addrs) {
    Write-Host ("    http://{0}:{1}/          ({2})" -f $a.IPAddress, $Port, $a.InterfaceAlias) -ForegroundColor Green
}
Write-Host ("    http://127.0.0.1:{0}/    (本机)" -f $Port) -ForegroundColor DarkGray
Write-Host ''
if ($sleepGuard) {
    Write-Host '  已阻止系统休眠；关闭此窗口即恢复。' -ForegroundColor DarkGray
}
Write-Host '  打不开时：管理员运行一次' -ForegroundColor DarkGray
Write-Host ("    New-NetFirewallRule -DisplayName 'gdufs-$Port' -Direction Inbound -LocalPort $Port -Protocol TCP -Action Allow") -ForegroundColor DarkGray
Write-Host ''
Write-Host '  按 Ctrl+C 停止。' -ForegroundColor DarkGray
Write-Host ''

try {
    # 兼容没有 python 别名、只有 py 启动器的机器（Windows 商店版 python.exe 是占位符）
    if (Get-Command py -ErrorAction SilentlyContinue) {
        & py -m http.server $Port --bind 0.0.0.0 --directory $root
    } else {
        & python -m http.server $Port --bind 0.0.0.0 --directory $root
    }
} finally {
    if ($sleepGuard) { [SleepGuard]::Release() }
}
