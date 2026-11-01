# Start a CDP-reachable headless chromium (default port 9333) and reuse it if already up.
# Why: inside this sandbox node cannot spawn a browser (crashpad/mojo cannot get handles),
# but PowerShell Start-Process can, so we start the process here and let node attach.
param(
  [int]$Port = 9333,
  [string]$Profile = 'C:\Users\86134\Desktop\gdufs\.browser-profile',
  [switch]$Restart
)

$ErrorActionPreference = 'Stop'

function Find-HeadlessShell {
  $roots = @("$env:LOCALAPPDATA\ms-playwright", "$env:USERPROFILE\.cache\ms-playwright")
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $dirs = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like 'chromium_headless_shell-*' } |
            Sort-Object Name -Descending
    foreach ($d in $dirs) {
      $exe = Get-ChildItem $d.FullName -Recurse -Filter 'chrome-headless-shell.exe' -ErrorAction SilentlyContinue |
             Select-Object -First 1
      if ($exe) { return $exe.FullName }
    }
  }
  foreach ($p in @(
      'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
      'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
      'C:\Program Files\Google\Chrome\Application\chrome.exe')) {
    if (Test-Path $p) { return $p }
  }
  throw 'no chromium/edge/chrome found'
}

$alive = $false
try {
  $r = Invoke-WebRequest "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 2
  if ($r.StatusCode -eq 200) { $alive = $true }
} catch { $alive = $false }

if ($alive -and -not $Restart) {
  Write-Output "already-up $Port"
  exit 0
}

if ($Restart) {
  Get-Process chrome, chrome-headless-shell, msedge -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 800
}

$exe = Find-HeadlessShell
$isShell = $exe -like '*headless-shell*'
$args = @(
  "--remote-debugging-port=$Port",
  "--user-data-dir=$Profile",
  '--no-sandbox',
  '--disable-breakpad',
  '--disable-crash-reporter',
  '--no-first-run',
  '--disable-gpu',
  '--window-size=1600,1000',
  'about:blank'
)
if (-not $isShell) { $args = @('--headless=new') + $args }

$logDir = Join-Path (Split-Path $Profile -Parent) 'artifacts'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Start-Process -FilePath $exe -ArgumentList $args -WindowStyle Hidden `
  -RedirectStandardError (Join-Path $logDir 'browser.err') `
  -RedirectStandardOutput (Join-Path $logDir 'browser.out') | Out-Null

for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 250
  try {
    $r = Invoke-WebRequest "http://127.0.0.1:$Port/json/version" -UseBasicParsing -TimeoutSec 2
    if ($r.StatusCode -eq 200) { Write-Output "up $Port $exe"; exit 0 }
  } catch { }
}
Write-Output "FAILED $Port"
Get-Content (Join-Path $logDir 'browser.err') -ErrorAction SilentlyContinue | Select-Object -First 8
exit 1
