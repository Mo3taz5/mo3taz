# 🚀 Deploy MO3TAZ Analytics to Fly.io

## Prerequisites

- A Fly.io account (free tier available)
- Node.js installed on your machine
- Your analytics-server.js ready

---

## Step-by-Step Deployment

### **Step 1: Install Fly CLI**

#### Windows:
```powershell
# Using scoop
scoop install flyctl

# OR download directly
iwr https://fly.io/install.ps1 -UseBasicParsing | iex
```

#### Alternative (manual download):
Go to: https://fly.io/docs/hands-on/install-flyctl/

---

### **Step 2: Login to Fly.io**

```bash
fly auth signup    # New account
# OR
fly auth login     # Existing account
```

---

### **Step 3: Prepare Your Files**

Create a new folder for the analytics server:

```bash
cd D:\sdk\test\hydra

# Create a dedicated folder
mkdir analytics-server
cd analytics-server

# Copy required files
copy ..\analytics-server.js .
copy ..\analytics-package.json package.json
copy ..\Dockerfile.analytics .
copy ..\fly.toml .
```

---

### **Step 4: Launch Your App**

```bash
# This will create your app on Fly.io
fly launch --name mo3taz-analytics --no-deploy

# Or launch directly:
fly launch --name mo3taz-analytics
```

Fly will ask you:
- **Organization:** Select your personal org (free)
- **Database:** No
- **Deploy now:** Yes

---

### **Step 5: Create Persistent Storage**

Fly.io free tier includes 3GB of volume storage.

```bash
# Create a 1GB volume (plenty for analytics)
fly volumes create analytics_data --size 1 --region ams
```

---

### **Step 6: Deploy**

```bash
# Deploy your app
fly deploy

# Watch the deployment logs
fly logs
```

---

### **Step 7: Get Your URL**

```bash
# Get your app URL
fly apps info

# Or just visit:
# https://mo3taz-analytics.fly.dev
```

**Your analytics endpoint will be:**
```
https://mo3taz-analytics.fly.dev/analytics
```

---

### **Step 8: Configure MO3TAZ Launcher**

Add to your `.env` file:

```env
MAIN_VITE_ANALYTICS_URL=https://mo3taz-analytics.fly.dev/analytics
```

Then rebuild your app:

```bash
cd D:\sdk\test\hydra
npm run build
```

---

## ✅ Test Your Deployment

### Test with curl:

```bash
# Send test event
curl -X POST https://mo3taz-analytics.fly.dev/analytics \
  -H "Content-Type: application/json" \
  -d '{"events":[{"appId":"test","anonymousId":"test123","event":"app_launch","timestamp":"2024-01-01T00:00:00.000Z"}]}'

# View summary
curl https://mo3taz-analytics.fly.dev/analytics/summary
```

### Test with your dashboard:

Open `analytics-dashboard.html` in your browser and update the URL:

```javascript
// Change this line:
const ANALYTICS_URL = 'https://mo3taz-analytics.fly.dev/analytics';
```

---

## 📊 Monitor Your App

```bash
# View logs
fly logs

# View app status
fly status

# View metrics
fly apps dashboard

# SSH into your app (for debugging)
fly ssh console
```

---

## 🔧 Useful Commands

```bash
# Restart app
fly apps restart

# View deployment history
fly releases

# Scale (free tier limit: 1 VM)
fly scale count 1

# Destroy app (if you want to start over)
fly apps destroy mo3taz-analytics

# Open web dashboard
fly dashboard
```

---

## 💰 Free Tier Limits

Fly.io free tier includes:

- ✅ **3 shared-cpu-1x VMs** (256MB RAM each)
- ✅ **3GB persistent storage**
- ✅ **160GB outbound transfer/month**
- ✅ **Always on** (doesn't sleep like Render!)

**Your analytics server will use:**
- 1 VM (256MB RAM)
- 1GB storage
- Minimal bandwidth

**This is 100% FREE** 🎉

---

## 🛡 Security (Optional)

### Add basic authentication:

```bash
# Set environment variable
fly secrets set ANALYTICS_PASSWORD=your-secret-password
```

Then update your `analytics-server.js` to check for a token in requests.

### Add CORS restrictions:

Update `analytics-server.js`:

```javascript
app.use(cors({
  origin: ['mo3taz://', 'http://localhost:5173'], // Your app origins
  methods: ['POST', 'GET', 'DELETE']
}));
```

---

## 📝 Troubleshooting

### App won't start:

```bash
# Check logs
fly logs

# Rebuild and redeploy
fly deploy --build-only
fly deploy
```

### Volume not mounting:

```bash
# Check volume status
fly volumes list

# Ensure volume is in same region as app
fly volumes show analytics_data
```

### App crashes on startup:

```bash
# SSH and check manually
fly ssh console
ls -la /app/data
cat /app/data/analytics-data.json
```

---

## 🎉 You're Done!

Your analytics server is now:
- ✅ Running 24/7 on Fly.io
- ✅ Has persistent storage
- ✅ Accessible via HTTPS
- ✅ Completely FREE

Now your MO3TAZ Launcher will send analytics data to:
```
https://mo3taz-analytics.fly.dev/analytics
```

---

## 📈 Next Steps

1. **Monitor usage:** `fly status`
2. **View analytics:** Open `analytics-dashboard.html`
3. **Set up alerts:** `fly checks add`
4. **Custom domain:** `fly certs add analytics.yourdomain.com`

Enjoy tracking your users! 🚀
