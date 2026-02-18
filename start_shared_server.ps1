# ╔══════════════════════════════════════════════════════════════╗
# ║  OrbitBharat — Start Server + ngrok Tunnel for Sharing     ║
# ║  Run this script when you want a friend to access your API ║
# ╚══════════════════════════════════════════════════════════════╝
#
# Usage:
#   .\start_shared_server.ps1
#
# Prerequisites:
#   1. ngrok installed  (winget install ngrok.ngrok)
#   2. ngrok auth token  (one-time: ngrok config add-authtoken YOUR_TOKEN)
#      Get your free token at https://dashboard.ngrok.com/get-started/your-authtoken

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OrbitBharat — Shared Server Launcher" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# --- Step 1: Start the Python API server in background ---
Write-Host "[1/3] Starting API server on port 8000..." -ForegroundColor Yellow
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot
    python api/server.py 2>&1
}
Start-Sleep -Seconds 3

# Quick health-check
try {
    $null = Invoke-WebRequest -Uri "http://localhost:8000/docs" -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  ✓ API server is running!" -ForegroundColor Green
} catch {
    Write-Host "  ⚠ Server may still be starting. Check logs with: Receive-Job $($serverJob.Id)" -ForegroundColor DarkYellow
}

# --- Step 2: Start ngrok tunnel ---
Write-Host ""
Write-Host "[2/3] Starting ngrok tunnel..." -ForegroundColor Yellow
$ngrokJob = Start-Job -ScriptBlock {
    ngrok http 8000 --log stdout 2>&1
}
Start-Sleep -Seconds 4

# --- Step 3: Fetch the public URL from ngrok API ---
Write-Host "[3/3] Fetching public URL..." -ForegroundColor Yellow
try {
    $tunnels = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -TimeoutSec 5
    $publicUrl = $tunnels.tunnels[0].public_url
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  PUBLIC URL (share this!):" -ForegroundColor Green
    Write-Host "  $publicUrl" -ForegroundColor White -BackgroundColor DarkGreen
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Copy the URL above" -ForegroundColor White
    Write-Host "  2. Open: Data visualization App\app\utils\cmePredictionApi.ts" -ForegroundColor White
    Write-Host "  3. Paste it as NGROK_URL:  const NGROK_URL = '$publicUrl';" -ForegroundColor White
    Write-Host "  4. Rebuild your Expo app and share it with your friend!" -ForegroundColor White
    Write-Host ""
    Write-Host "  Or set it as env var:  `$env:EXPO_PUBLIC_CME_API_URL = '$publicUrl'" -ForegroundColor DarkGray
    Write-Host ""
    Write-Host "ngrok dashboard: http://localhost:4040" -ForegroundColor DarkGray
} catch {
    Write-Host "  ⚠ Could not fetch ngrok URL automatically." -ForegroundColor Red
    Write-Host "  Open http://localhost:4040 in your browser to see the URL." -ForegroundColor Yellow
    Write-Host "  Make sure you've set your authtoken: ngrok config add-authtoken YOUR_TOKEN" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press Ctrl+C to stop both server and tunnel." -ForegroundColor DarkGray
Write-Host ""

# Keep alive — press Ctrl+C to stop
try {
    while ($true) {
        Start-Sleep -Seconds 5
        # Show server output if any
        $output = Receive-Job $serverJob -ErrorAction SilentlyContinue
        if ($output) { $output | ForEach-Object { Write-Host "  [SERVER] $_" -ForegroundColor DarkGray } }
    }
} finally {
    Write-Host "`nStopping server and tunnel..." -ForegroundColor Yellow
    Stop-Job $serverJob, $ngrokJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob, $ngrokJob -Force -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
