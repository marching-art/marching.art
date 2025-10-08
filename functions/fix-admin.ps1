$file = "src\callable\admin.js"
$fullPath = Join-Path $PSScriptRoot $file

if (Test-Path $fullPath) {
    Write-Host "Fixing admin.js..." -ForegroundColor Cyan
    
    $content = Get-Content $fullPath -Raw
    
    # Fix the imports at the top
    $content = $content -replace `
        "const functions = require\('firebase-functions'\);`nconst admin = require\('firebase-admin'\);`n`n/\*\*`n \* marching\.art Admin Functions", `
        "/**`n * marching.art Admin Functions"
    
    $content = $content -replace `
        "/\*\*`n \* marching\.art Admin Functions - COMPLETE VERSION`n \* Comprehensive season administration tools for ultimate efficiency`n \* Designed for scalability to 10,000\+ users with minimal cost`n \*/`n`n// Configuration constants`nconst DATA_NAMESPACE = 'marching-art';`nconst ADMIN_USER_ID = 'o8vfRCOevjTKBY0k2dISlpiYiIH2';", `
        "/**`n * marching.art Admin Functions - COMPLETE VERSION`n * Comprehensive season administration tools for ultimate efficiency`n * Designed for scalability to 10,000+ users with minimal cost`n * `n * Location: functions/src/callable/admin.js`n */`n`nconst functions = require('firebase-functions');`nconst admin = require('firebase-admin');`nconst { DATA_NAMESPACE, ADMIN_USER_ID, getFunctionConfig } = require('../../config');"
    
    # Fix function exports
    $content = $content -replace `
        "exports\.getSystemStats = functions\.https\.onCall", `
        "exports.getSystemStats = functions`n  .runWith(getFunctionConfig('standard'))`n  .https.onCall"
    
    $content = $content -replace `
        "exports\.seasonAction = functions`n  \.runWith\(\{ timeoutSeconds: 540, memory: '1GB' \}\)", `
        "exports.seasonAction = functions`n  .runWith(getFunctionConfig('heavy'))"
    
    Set-Content $fullPath -Value $content -NoNewline
    Write-Host "✅ Fixed admin.js" -ForegroundColor Green
} else {
    Write-Host "❌ File not found: $file" -ForegroundColor Red
}

Write-Host "`nRun: firebase deploy --only functions" -ForegroundColor Yellow