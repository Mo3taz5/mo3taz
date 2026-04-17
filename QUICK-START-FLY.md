# 🚀 Quick Start: Deploy to Fly.io (5 Minutes)

## Copy-Paste Commands

```bash
# 1. Install Fly CLI (Windows PowerShell)
iwr https://fly.io/install.ps1 -UseBasicParsing | iex

# 2. Login
fly auth signup

# 3. Go to your project
cd D:\sdk\test\hydra

# 4. Create deployment folder
mkdir analytics-deploy
cd analytics-deploy
copy ..\analytics-server.js .
copy ..\analytics-package.json package.json
copy ..\Dockerfile.analytics .
copy ..\fly.toml .

# 5. Launch on Fly.io
fly launch --name mo3taz-analytics --region ams

# 6. Create storage volume
fly volumes create analytics_data --size 1 --region ams

# 7. Deploy
fly deploy

# 8. Get your URL
fly apps info
```

---

## Your Analytics URL

```
https://mo3taz-analytics.fly.dev/analytics
```

---

## Configure Your Launcher

Add to `D:\sdk\test\hydra\.env`:

```env
MAIN_VITE_ANALYTICS_URL=https://mo3taz-analytics.fly.dev/analytics
```

---

## Rebuild & Test

```bash
# Rebuild launcher
cd D:\sdk\test\hydra
npm run build

# Test analytics server
curl https://mo3taz-analytics.fly.dev/analytics/summary
```

---

## Dashboard

Open `analytics-dashboard.html` in your browser and change the URL to your Fly.io endpoint.

---

## Done! ✅

Your analytics are now collecting data 24/7 on Fly.io!

**Free tier includes:**
- ✅ 3 VMs (you're using 1)
- ✅ 3GB storage (you're using 1GB)
- ✅ 160GB bandwidth/month
- ✅ Always on (never sleeps!)
