# Starts admin-required Go backends with fixed ports (avoids polluted HTTP_ADDR).
# Usage: powershell -File scripts/dev-backends.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { $Root = (Get-Location).Path }

# Load .env silently
$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $i = $_.IndexOf('='); if ($i -lt 1) { return }
    $k = $_.Substring(0, $i).Trim(); $v = $_.Substring($i + 1).Trim()
    if ($k) { Set-Item -Path "Env:$k" -Value $v }
  }
}
if (-not $env:GOOGLE_CLIENT_ID -and $env:NEXT_PUBLIC_GOOGLE_CLIENT_ID) {
  $env:GOOGLE_CLIENT_ID = $env:NEXT_PUBLIC_GOOGLE_CLIENT_ID
}
if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgres://adb:adb_dev_password@localhost:5433/adb_ticaret?sslmode=disable"
}

$services = @(
  @{ Name = "auth";         Dir = "services/backend/auth";         Addr = ":8081"; Cmd = "./cmd/auth" }
  @{ Name = "customer";     Dir = "services/backend/customer";     Addr = ":8082"; Cmd = "./cmd/customer" }
  @{ Name = "catalog";      Dir = "services/backend/catalog";      Addr = ":8083"; Cmd = "./cmd/catalog" }
  @{ Name = "inventory";    Dir = "services/backend/inventory";    Addr = ":8084"; Cmd = "./cmd/inventory" }
  @{ Name = "pricing";      Dir = "services/backend/pricing";      Addr = ":8085"; Cmd = "./cmd/pricing" }
  @{ Name = "promotion";    Dir = "services/backend/promotion";    Addr = ":8086"; Cmd = "./cmd/promotion" }
  @{ Name = "cart";         Dir = "services/backend/cart";         Addr = ":8087"; Cmd = "./cmd/cart" }
  @{ Name = "checkout";     Dir = "services/backend/checkout";     Addr = ":8088"; Cmd = "./cmd/checkout" }
  @{ Name = "order";        Dir = "services/backend/order";        Addr = ":8089"; Cmd = "./cmd/order" }
  @{ Name = "payment";      Dir = "services/backend/payment";      Addr = ":8090"; Cmd = "./cmd/payment" }
  @{ Name = "shipment";     Dir = "services/backend/shipment";     Addr = ":8091"; Cmd = "./cmd/shipment" }
  @{ Name = "notification"; Dir = "services/backend/notification"; Addr = ":8092"; Cmd = "./cmd/notification" }
  @{ Name = "search";       Dir = "services/backend/search";       Addr = ":8093"; Cmd = "./cmd/search" }
  @{ Name = "review";       Dir = "services/backend/review";       Addr = ":8094"; Cmd = "./cmd/review" }
  @{ Name = "wishlist";     Dir = "services/backend/wishlist";     Addr = ":8095"; Cmd = "./cmd/wishlist" }
  @{ Name = "marketplace";  Dir = "services/backend/marketplace";  Addr = ":8096"; Cmd = "./cmd/marketplace" }
  @{ Name = "accounting";   Dir = "services/backend/accounting";   Addr = ":8097"; Cmd = "./cmd/accounting" }
  @{ Name = "reporting";    Dir = "services/backend/reporting";    Addr = ":8098"; Cmd = "./cmd/reporting" }
  @{ Name = "worker";       Dir = "services/backend/worker";       Addr = ":8099"; Cmd = "./cmd/worker" }
  @{ Name = "cms";          Dir = "services/backend/cms";          Addr = ":8100"; Cmd = "./cmd/cms" }
  @{ Name = "retail";       Dir = "services/backend/retail";       Addr = ":8101"; Cmd = "./cmd/retail" }
  @{ Name = "gateway";      Dir = "services/backend/gateway";      Addr = ":8080"; Cmd = "./cmd/gateway" }
)

$logDir = Join-Path $Root ".dev-logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

foreach ($svc in $services) {
  $port = [int]($svc.Addr.TrimStart(":"))
  $existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($existing) {
    Write-Host "[skip] $($svc.Name) already on $port"
    continue
  }
  $work = Join-Path $Root $svc.Dir
  $outLog = Join-Path $logDir "$($svc.Name).out.log"
  $errLog = Join-Path $logDir "$($svc.Name).err.log"
  Write-Host "[start] $($svc.Name) $($svc.Addr)"
  $env:HTTP_ADDR = $svc.Addr
  if ($svc.Name -eq "search") {
    $env:CATALOG_URL = "http://localhost:8083"
    if (-not $env:ELASTICSEARCH_URL) { $env:ELASTICSEARCH_URL = "http://localhost:9200" }
  }
  Start-Process -FilePath "go" -ArgumentList @("run", $svc.Cmd) -WorkingDirectory $work `
    -WindowStyle Hidden -RedirectStandardOutput $outLog -RedirectStandardError $errLog
}

# Realtime (socket.io) — separate Node process
$rtDir = Join-Path $Root "services/realtime"
$rtPort = 8102
$rtExisting = Get-NetTCPConnection -LocalPort $rtPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($rtExisting) {
  Write-Host "[skip] realtime already on $rtPort"
} elseif (Test-Path (Join-Path $rtDir "server.mjs")) {
  Write-Host "[start] realtime :$rtPort"
  if (-not $env:REALTIME_INTERNAL_SECRET) { $env:REALTIME_INTERNAL_SECRET = "adb-dev-realtime" }
  $env:REALTIME_PORT = "$rtPort"
  $rtOut = Join-Path $logDir "realtime.out.log"
  $rtErr = Join-Path $logDir "realtime.err.log"
  Start-Process -FilePath "node" -ArgumentList @("server.mjs") -WorkingDirectory $rtDir `
    -WindowStyle Hidden -RedirectStandardOutput $rtOut -RedirectStandardError $rtErr
} else {
  Write-Host "[skip] realtime (services/realtime missing)"
}

Write-Host "Done. Logs: $logDir"
Write-Host "Tip: ES icin 'make search-infra' sonra 'make search-reindex'"
