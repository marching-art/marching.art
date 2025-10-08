# Complete import path fix for all function files
Write-Host "=== Fixing Import Paths in All Function Files ===" -ForegroundColor Cyan
Write-Host ""

$files = @{
    # Callable functions (need ../../config)
    "src\callable\corps.js" = "../../config"
    "src\callable\lineups.js" = "../../config"
    "src\callable\showRegistration.js" = "../../config"
    "src\callable\staff.js" = "../../config"
    "src\callable\users.js" = "../../config"
    "src\callable\uniforms.js" = "../../config"
    "src\callable\admin.js" = "../../config"
    
    # Triggers (need ../../config)
    "src\triggers\auth.js" = "../../config"
    
    # Scheduled functions (need ../../config)
    "src\scheduled\liveScoreScraper.js" = "../../config"
    "src\scheduled\scoreProcessor.js" = "../../config"
    "src\scheduled\seasonScheduler.js" = "../../config"
    
    # Admin functions (need ../../config)
    "src\admin\initializeStaff.js" = "../../config"
}

$fixedCount = 0
$errorCount = 0

foreach ($file in $files.Keys) {
    $fullPath = Join-Path $PSScriptRoot $file
    $expectedPath = $files[$file]
    
    if (Test-Path $fullPath) {
        Write-Host "Processing $file..." -ForegroundColor Yellow
        
        try {
            $content = Get-Content $fullPath -Raw -ErrorAction Stop
            $modified = $false
            
            # Fix wrong import paths
            if ($content -match "require\([`"']\.\.\/config[`"']\)") {
                $content = $content -replace "require\([`"']\.\.\/config[`"']\)", "require('$expectedPath')"
                $modified = $true
                Write-Host "  → Fixed ../config to $expectedPath" -ForegroundColor Green
            }
            
            # Add getFunctionConfig if missing
            if ($content -match "const \{ DATA_NAMESPACE \} = require" -and 
                $content -notmatch "getFunctionConfig") {
                $content = $content -replace `
                    "const \{ DATA_NAMESPACE \} = require", `
                    "const { DATA_NAMESPACE, getFunctionConfig } = require"
                $modified = $true
                Write-Host "  → Added getFunctionConfig import" -ForegroundColor Green
            }
            
            # Add .runWith(getFunctionConfig('light')) to exports that don't have it
            # Match: exports.functionName = functions.https.onCall or functions.auth.user()
            if ($content -match "exports\.\w+ = functions\.(https\.onCall|auth\.user\(\))" -and
                $content -notmatch "runWith\(getFunctionConfig") {
                
                # For https.onCall functions
                $content = $content -replace `
                    "(exports\.\w+ = functions)\.https\.onCall", `
                    "`$1`n  .runWith(getFunctionConfig('light'))`n  .https.onCall"
                
                # For auth trigger functions  
                $content = $content -replace `
                    "(exports\.\w+ = functions)\.auth\.user\(\)", `
                    "`$1`n  .runWith(getFunctionConfig('light'))`n  .auth.user()"
                
                $modified = $true
                Write-Host "  → Added .runWith(getFunctionConfig) to exports" -ForegroundColor Green
            }
            
            if ($modified) {
                Set-Content $fullPath -Value $content -NoNewline -ErrorAction Stop
                $fixedCount++
                Write-Host "  ✅ Successfully fixed $file" -ForegroundColor Green
            } else {
                Write-Host "  ⚪ No changes needed for $file" -ForegroundColor Gray
            }
            
        } catch {
            Write-Host "  ❌ Error processing $file : $_" -ForegroundColor Red
            $errorCount++
        }
        
    } else {
        Write-Host "  ⚠️  File not found: $file" -ForegroundColor Yellow
    }
    
    Write-Host ""
}

Write-Host "=== Summary ===" -ForegroundColor Cyan
Write-Host "Files fixed: $fixedCount" -ForegroundColor Green
Write-Host "Errors: $errorCount" -ForegroundColor $(if ($errorCount -gt 0) { "Red" } else { "Green" })
Write-Host ""

if ($fixedCount -gt 0 -or $errorCount -eq 0) {
    Write-Host "✅ Ready to deploy! Run: firebase deploy --only functions" -ForegroundColor Green
} else {
    Write-Host "⚠️  Please review errors above before deploying" -ForegroundColor Yellow
}