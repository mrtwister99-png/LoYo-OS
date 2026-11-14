# LoYo F3 Critical Fixes - apply.ps1
# Spusti z rootu projektu: powershell -ExecutionPolicy Bypass -File apply.ps1

Write-Host "=== LoYo F3 Fixes - 4 kriticke patche ===" -ForegroundColor Cyan

$fixes = @(
  @{ src="patches/01-capabilities-TYPE_FOLDER-fix.ts"; dst="apps/api/src/routes/capabilities.ts" },
  @{ src="patches/02-notesTasksFts-MATCH-fix.ts"; dst="apps/api/src/lib/notesTasksFts.ts" },
  @{ src="patches/02b-search-MATCH-fix.ts"; dst="apps/api/src/routes/search.ts" },
  @{ src="patches/03-connection-singleton-fix.ts"; dst="apps/api/src/lib/connection.ts" },
  @{ src="patches/03b-manifestDb-singleton-fix.ts"; dst="apps/api/src/lib/manifestDb.ts" },
  @{ src="patches/04-tmp-traversal-fix.ts"; dst="apps/api/src/routes/tmp.ts" }
)

foreach ($f in $fixes) {
  if (Test-Path $f.src) {
    Copy-Item $f.src $f.dst -Force
    Write-Host "✓ $($f.dst)" -ForegroundColor Green
  } else {
    Write-Host "✗ Chybí $($f.src)" -ForegroundColor Red
  }
}

Write-Host "`nHotovo! Zkontroluj: pnpm --filter api typecheck" -ForegroundColor Cyan
Write-Host "Pak: pnpm dev" -ForegroundColor Cyan
