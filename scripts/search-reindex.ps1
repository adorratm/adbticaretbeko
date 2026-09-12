# Reindex catalog products into Elasticsearch via search service.
# Prerequisites: make search-infra, search service on :8093 (or via gateway :8080)

$ErrorActionPreference = "Stop"
$base = if ($env:GATEWAY_PUBLIC_URL) { $env:GATEWAY_PUBLIC_URL.TrimEnd("/") } else { "http://localhost:8080" }
$url = "$base/api/v1/search/reindex"

Write-Host "POST $url"
try {
  $res = Invoke-RestMethod -Method POST -Uri $url -ContentType "application/json" -TimeoutSec 60
  $res | ConvertTo-Json -Depth 5
  if ($res.ok) {
    Write-Host "Reindex OK — indexed: $($res.indexed)"
  }
} catch {
  Write-Host "Reindex failed: $($_.Exception.Message)"
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
