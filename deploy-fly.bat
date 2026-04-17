@echo off
echo ========================================
echo  MO3TAZ Analytics - Fly.io Deployer
echo ========================================
echo.

REM Check if flyctl is installed
where flyctl >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] flyctl is not installed!
    echo.
    echo Install it with:
    echo   iwr https://fly.io/install.ps1 -UseBasicParsing ^| iex
    echo.
    pause
    exit /b 1
)

echo [1/6] Checking authentication...
fly auth whoami 2>nul
if %errorlevel% neq 0 (
    echo Not logged in. Please login:
    echo   fly auth signup  (new account)
    echo   fly auth login   (existing account)
    echo.
    pause
    exit /b 1
)
echo ✓ Authenticated
echo.

echo [2/6] Preparing files...
if not exist "analytics-server" mkdir analytics-server
copy /Y analytics-server.js analytics-server\ >nul
copy /Y analytics-package.json analytics-server\package.json >nul
copy /Y Dockerfile.analytics analytics-server\ >nul
copy /Y fly.toml analytics-server\ >nul
echo ✓ Files prepared
echo.

echo [3/6] Creating app on Fly.io...
cd analytics-server
fly launch --name mo3taz-analytics --no-deploy --region ams --org personal --now
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create app
    pause
    exit /b 1
)
echo ✓ App created
echo.

echo [4/6] Creating persistent volume...
fly volumes create analytics_data --size 1 --region ams --app mo3taz-analytics
echo ✓ Volume created
echo.

echo [5/6] Deploying...
fly deploy --app mo3taz-analytics
if %errorlevel% neq 0 (
    echo [ERROR] Deployment failed
    pause
    exit /b 1
)
echo ✓ Deployed successfully
echo.

echo [6/6] Getting your analytics URL...
echo.
fly apps info --app mo3taz-analytics | findstr /C:"Hostname"
echo.

echo ========================================
echo  ✓ DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Your analytics server is now running at:
echo   https://mo3taz-analytics.fly.dev/analytics
echo.
echo Next steps:
echo   1. Add to your .env file:
echo      MAIN_VITE_ANALYTICS_URL=https://mo3taz-analytics.fly.dev/analytics
echo.
echo   2. Rebuild your launcher:
echo      npm run build
echo.
echo   3. Open analytics-dashboard.html in your browser
echo.

cd ..
pause
