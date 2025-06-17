# DEX Aggregator Project Cleanup Script
# This script removes unnecessary files and folders

Write-Host "🧹 Starting project cleanup..." -ForegroundColor Green

# Remove unnecessary contract files
Write-Host "Removing unused contract files..." -ForegroundColor Yellow
$contractsToRemove = @(
    "contracts\BasicTest.sol",
    "contracts\MinimalTest.sol", 
    "contracts\SimpleToken.sol",
    "contracts\StepByStepToken.sol"
)

foreach ($file in $contractsToRemove) {
    if (Test-Path $file) {
        Remove-Item $file
        Write-Host "✅ Removed: $file"
    }
}

# Remove unnecessary script files
Write-Host "Removing unused script files..." -ForegroundColor Yellow
$scriptsToRemove = @(
    "scripts\test_basic.js",
    "scripts\test_minimal.js",
    "scripts\test_simple_token.js", 
    "scripts\test_stepbystep.js",
    "scripts\test_token_deploy.js",
    "scripts\test_with_manual_gas.js",
    "scripts\test_working_token.js",
    "scripts\deploy_all.js",
    "scripts\deploy_amm1.js",
    "scripts\deploy_amm2.js", 
    "scripts\deploy_aggregator.js"
)

foreach ($file in $scriptsToRemove) {
    if (Test-Path $file) {
        Remove-Item $file
        Write-Host "✅ Removed: $file"
    }
}

# Remove Zone.Identifier files (Windows security metadata)
Write-Host "Removing Zone.Identifier files..." -ForegroundColor Yellow
Get-ChildItem -Recurse -Name "*Zone.Identifier" | ForEach-Object {
    Remove-Item $_
    Write-Host "✅ Removed: $_"
}

# Optional: Remove charts components if not needed
Write-Host "Do you want to remove Charts components? (y/n): " -ForegroundColor Cyan -NoNewline
$removeCharts = Read-Host
if ($removeCharts -eq "y" -or $removeCharts -eq "Y") {
    $chartsToRemove = @(
        "src\components\Charts.js",
        "src\components\Charts.config.js"
    )
    
    foreach ($file in $chartsToRemove) {
        if (Test-Path $file) {
            Remove-Item $file
            Write-Host "✅ Removed: $file"
        }
    }
}

# Optional: Remove liquidity components if only using aggregator
Write-Host "Do you want to remove Deposit/Withdraw components? (y/n): " -ForegroundColor Cyan -NoNewline
$removeLiquidity = Read-Host  
if ($removeLiquidity -eq "y" -or $removeLiquidity -eq "Y") {
    $liquidityToRemove = @(
        "src\components\Deposit.js",  
        "src\components\Withdraw.js"
    )
    
    foreach ($file in $liquidityToRemove) {
        if (Test-Path $file) {
            Remove-Item $file
            Write-Host "✅ Removed: $file"
        }
    }
}

Write-Host "🎉 Cleanup completed!" -ForegroundColor Green
Write-Host "Your project is now cleaner and more organized." -ForegroundColor Green
