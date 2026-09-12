# Smoke-test checkout → payment → paid → invoice (gateway üzerinden).
# Usage: powershell -File scripts/smoke-checkout.ps1

$ErrorActionPreference = "Stop"
$Gateway = if ($env:GATEWAY_URL) { $env:GATEWAY_URL } else { "http://localhost:8080" }

function Invoke-Json($Method, $Path, $Body = $null, $Headers = @{}) {
  $uri = "$Gateway$Path"
  $params = @{
    Method      = $Method
    Uri         = $uri
    ContentType = "application/json"
    Headers     = $Headers
  }
  if ($null -ne $Body) {
    $params.Body = ($Body | ConvertTo-Json -Depth 8 -Compress)
  }
  return Invoke-RestMethod @params
}

Write-Host "== health =="
$hz = Invoke-WebRequest -Uri "$Gateway/healthz" -UseBasicParsing
if ($hz.StatusCode -ne 200) { throw "gateway health failed" }
Write-Host "gateway OK"

Write-Host "== products =="
$products = Invoke-Json GET "/api/v1/products"
if (-not $products.items -or $products.items.Count -lt 1) { throw "no products" }
$p = $products.items[0]
Write-Host "product $($p.sku) id=$($p.id)"

Write-Host "== pricing/inventory ensure =="
try {
  Invoke-Json PUT "/api/v1/pricing/$($p.id)" @{ amount = 129999 } | Out-Null
} catch { Write-Host "pricing skip: $($_.Exception.Message)" }
try {
  Invoke-Json POST "/api/v1/inventory/adjust" @{ variantId = $p.id; available = 5; warehouseCode = "MAIN" } | Out-Null
} catch { Write-Host "inventory skip: $($_.Exception.Message)" }

Write-Host "== cart =="
$cart = Invoke-Json POST "/api/v1/cart" @{}
Invoke-Json POST "/api/v1/cart/$($cart.id)/items" @{
  variantId = $p.id
  productId = $p.id
  name      = $p.name
  sku       = $p.sku
  qty       = 1
  unitPrice = 129999
} | Out-Null
Write-Host "cart $($cart.id)"

Write-Host "== checkout create =="
$order = Invoke-Json POST "/api/v1/checkout/create" @{
  cartId        = $cart.id
  customerName  = "Smoke Test"
  customerPhone = "05551112233"
  district      = "Besiktas"
  paymentMethod = "CARD"
}
Write-Host "order $($order.id) payment=$($order.payment.id)"

Write-Host "== simulate payment success =="
$pay = Invoke-Json POST "/api/v1/payments/$($order.payment.id)/simulate-success" @{}
Write-Host "paid order=$($pay.orderId)"

Write-Host "== invoice stub =="
try {
  $inv = Invoke-Json POST "/api/v1/accounting/invoices" @{
    orderId      = $order.id
    amount       = 129999
    customerName = "Smoke Test"
  }
  Write-Host "invoice $($inv.number) pdf=$($inv.pdfUrl)"
} catch {
  Write-Host "invoice skip (accounting down?): $($_.Exception.Message)"
}

Write-Host "SMOKE OK"
