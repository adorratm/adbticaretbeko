# .env.example anahtarlarını .env içine ekler (mevcut değerleri bozmaz).
# Usage: powershell -File scripts/sync-env.ps1
#        yarn sync:env

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Example = Join-Path $Root ".env.example"
$EnvFile = Join-Path $Root ".env"

if (-not (Test-Path $Example)) { throw ".env.example bulunamadı" }

function Get-EnvKeys($path) {
  $keys = [ordered]@{}
  Get-Content $path -ErrorAction SilentlyContinue | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $i = $line.IndexOf("=")
    if ($i -lt 1) { return }
    $k = $line.Substring(0, $i).Trim()
    $v = $line.Substring($i + 1)
    if (-not $keys.Contains($k)) { $keys[$k] = $v }
  }
  return $keys
}

$exampleKeys = Get-EnvKeys $Example
if (-not (Test-Path $EnvFile)) {
  Copy-Item $Example $EnvFile
  Write-Host ".env oluşturuldu (.env.example kopyası)"
  exit 0
}

$envKeys = Get-EnvKeys $EnvFile
$missing = @()
foreach ($k in $exampleKeys.Keys) {
  if (-not $envKeys.Contains($k)) { $missing += $k }
}

if ($missing.Count -eq 0) {
  Write-Host ".env güncel — eksik anahtar yok ($($exampleKeys.Count) anahtar)"
  exit 0
}

$stamp = Get-Date -Format "yyyy-MM-dd"
Add-Content -Path $EnvFile -Value ""
Add-Content -Path $EnvFile -Value "# --- sync-env $stamp (.env.example'dan eksik anahtarlar) ---"
foreach ($k in $missing) {
  Add-Content -Path $EnvFile -Value "$k=$($exampleKeys[$k])"
  Write-Host "+ $k"
}
Write-Host "Tamam: $($missing.Count) anahtar eklendi (mevcut değerler korundu)"
