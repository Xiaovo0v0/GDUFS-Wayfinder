param(
  [string]$Base,
  [string]$Path,
  [int]$Pages,
  [string]$OutFile,
  [int]$PageOffsetMode = 0
)
$ProgressPreference = 'SilentlyContinue'
$baseUri = [Uri]$Base
$sb = New-Object System.Text.StringBuilder
$total = 0
for ($i = 1; $i -le $Pages; $i++) {
  if ($i -eq 1) { $url = $Base + $Path }
  else {
    if ($PageOffsetMode -eq 1) {
      $n = $Pages - $i + 1
      $url = $Base + $Path.Replace('.htm', "/$n.htm")
    } else {
      $url = $Base + $Path.Replace('.htm', "/$i.htm")
    }
  }
  try {
    $wc = New-Object System.Net.WebClient
    $wc.Headers.Add('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    $bytes = $wc.DownloadData($url)
    $html = [System.Text.Encoding]::UTF8.GetString($bytes)
  } catch { [void]$sb.AppendLine("ERR|$url|$($_.Exception.Message)"); continue }
  $ms = [regex]::Matches($html, '<a[^>]*href="([^"]*(?:info|contet)[^"]*)"[^>]*title="([^"]*)"')
  foreach ($m in $ms) {
    $href = $m.Groups[1].Value
    try { $abs = [Uri]::new($baseUri, $href.Replace('../', '/')).AbsoluteUri } catch { $abs = $href }
    $t = $m.Groups[2].Value -replace '\s+', ' '
    [void]$sb.AppendLine("$i|$abs|$t")
    $total++
  }
  Start-Sleep -Milliseconds 120
}
$sb.ToString() | Out-File -FilePath $OutFile -Encoding utf8
"$OutFile : $total items"
