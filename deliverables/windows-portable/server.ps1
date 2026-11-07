param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'app'))
$listener = $null
for ($port = 8080; $port -lt 8180; $port++) {
    try {
        $candidate = New-Object Net.Sockets.TcpListener ([Net.IPAddress]::Loopback), $port
        $candidate.Start()
        $listener = $candidate
        break
    } catch { if ($candidate) { $candidate.Stop() } }
}
if (-not $listener) { throw 'No local port is available between 8080 and 8179.' }
$url = "http://127.0.0.1:$port/"
Write-Host ''
Write-Host '  尚行 · GDUFS Wayfinder' -ForegroundColor Cyan
Write-Host "  已启动：$url" -ForegroundColor Green
Write-Host '  请保持此窗口运行。结束使用后关闭窗口即可。'
Write-Host '  语心在线问答需要连接并登录广外校园网。'
Write-Host ''
if (-not $NoBrowser) { Start-Process $url }
$mime = @{
    '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'
    '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8'
    '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.svg'='image/svg+xml'
    '.glb'='model/gltf-binary'; '.ico'='image/x-icon'; '.woff2'='font/woff2'
}
try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout=5000; $client.SendTimeout=15000
            $stream=$client.GetStream()
            $reader=New-Object IO.StreamReader($stream,[Text.Encoding]::ASCII,$false,1024,$true)
            $line=$reader.ReadLine()
            if (-not $line) { continue }
            $parts=$line.Split(' ')
            $length=0
            while ($true) {
                $h=$reader.ReadLine(); if ([string]::IsNullOrEmpty($h)) { break }
                $length += $h.Length
                if ($length -gt 32768) { throw 'Request headers too long' }
            }
            $status='200 OK'; $type='text/plain; charset=utf-8'; $bytes=[byte[]]@()
            if ($parts[0] -notin @('GET','HEAD')) {
                $status='405 Method Not Allowed'; $bytes=[Text.Encoding]::UTF8.GetBytes('Method not allowed')
            } else {
                $path=[Uri]::UnescapeDataString(($parts[1] -split '\?',2)[0]).Replace('/','\')
                if ($path -eq '\') { $path='\index.html' }
                $target=[IO.Path]::GetFullPath((Join-Path $root $path.TrimStart('\')))
                if (-not $target.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) {
                    $status='403 Forbidden'; $bytes=[Text.Encoding]::UTF8.GetBytes('Forbidden')
                } elseif (-not [IO.File]::Exists($target)) {
                    $status='404 Not Found'; $bytes=[Text.Encoding]::UTF8.GetBytes('Not found')
                } else {
                    $bytes=[IO.File]::ReadAllBytes($target)
                    $ext=[IO.Path]::GetExtension($target).ToLowerInvariant()
                    $type=if ($mime.ContainsKey($ext)) {$mime[$ext]} else {'application/octet-stream'}
                }
            }
            $header="HTTP/1.1 $status`r`nContent-Type: $type`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nCache-Control: no-cache`r`nX-Content-Type-Options: nosniff`r`n`r`n"
            $head=[Text.Encoding]::ASCII.GetBytes($header)
            $stream.Write($head,0,$head.Length)
            if ($parts[0] -ne 'HEAD') { $stream.Write($bytes,0,$bytes.Length) }
        } catch { Write-Host "请求未完成：$($_.Exception.Message)" -ForegroundColor DarkGray }
        finally { $client.Close() }
    }
} finally { $listener.Stop() }
