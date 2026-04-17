@echo off
echo ========================================
echo  MO3TAZ Analytics - Cloudflare Deployer
echo ========================================
echo.

REM Check if wrangler is installed
where wrangler >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] wrangler is not installed!
    echo.
    echo Install it with:
    echo   npm install -g wrangler
    echo.
    pause
    exit /b 1
)

echo [IMPORTANT] If you get permission errors:
echo   1. Right-click PowerShell
echo   2. Select "Run as Administrator"
echo   3. Run this script again
echo.
pause

cd cloudflare-worker

echo [1/4] Installing dependencies...
npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo ✓ Dependencies installed
echo.

echo [2/4] Logging into Cloudflare...
echo A browser window will open. Click "Allow" to authorize.
echo.
wrangler login
if %errorlevel% neq 0 (
    echo [ERROR] Login failed
    pause
    exit /b 1
)
echo ✓ Logged in
echo.

echo [3/4] Creating KV namespace...
echo.
wrangler kv:namespace create "ANALYTICS_DATA"
echo.
echo [IMPORTANT] Copy the KV namespace ID and update wrangler.toml!
echo.
echo Edit wrangler.toml and replace:
echo   id = "YOUR_KV_NAMESPACE_ID"
echo   preview_id = "YOUR_PREVIEW_KV_NAMESPACE_ID"
echo.
echo With your actual ID (both should be the same).
echo.
pause

echo [4/4] Deploying to Cloudflare...
wrangler deploy
if %errorlevel% neq 0 (
    echo [ERROR] Deployment failed
    pause
    exit /b 1
)
echo.

cd ..

echo ========================================
echo  ✓ DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Your analytics server is now running at:
echo   https://mo3taz-analytics.YOURUSERNAME.workers.dev/analytics
echo.
echo Next steps:
echo   1. Replace YOURUSERNAME with your actual Cloudflare username
echo.
echo   2. Add to your .env file:
echo      MAIN_VITE_ANALYTICS_URL=https://mo3taz-analytics.YOURUSERNAME.workers.dev/analytics
echo.
echo   3. Rebuild your launcher:
echo      npm run build
echo.
echo   4. Open analytics-dashboard.html in your browser
echo.

pause
