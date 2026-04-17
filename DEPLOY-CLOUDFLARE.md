# 🚀 Deploy MO3TAZ Analytics to Cloudflare Workers

## ✅ What You Get
- **100,000 requests/day FREE** (3 million/month!)
- **No credit card needed**
- **Never sleeps**
- **Global CDN (200+ locations)**
- **1GB KV storage FREE**

---

## 🛠 Step-by-Step Deployment

### **Step 1: Fix Wrangler Permission Error**

The error you got is because of Windows path permissions. Here's how to fix it:

#### **Option A: Run as Administrator (Easiest)**

1. Press `Windows + X`
2. Select **Terminal (Admin)** or **PowerShell (Admin)**
3. Run:
   ```powershell
   wrangler deploy
   ```

#### **Option B: Change Wrangler Config Path**

```powershell
# Set a different config path
$env:XDG_CONFIG_HOME = "$env:USERPROFILE\.cloudflare-config"

# Then login
wrangler login

# Deploy
wrangler deploy
```

#### **Option C: Manual Fix (If Options A & B fail)**

```powershell
# Take ownership of the config folder
takeown /F "%APPDATA%\xdg.config\.wrangler" /R
icacls "%APPDATA%\xdg.config\.wrangler" /grant "%USERNAME%:F" /T

# Then try again
wrangler login
wrangler deploy
```

---

### **Step 2: Create Cloudflare Account**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/sign-up/workers)
2. Sign up (use any email, no credit card needed for free tier)
3. Verify your email

---

### **Step 3: Install Dependencies**

```powershell
cd D:\sdk\test\hydra\cloudflare-worker

# Install packages
npm install
```

---

### **Step 4: Login to Cloudflare**

```powershell
# Open PowerShell as Administrator
wrangler login
```

A browser window will open. Click "Allow" to authorize Wrangler.

---

### **Step 5: Create KV Namespace**

KV (Key-Value) storage is where your analytics data will be stored.

```powershell
# Create KV namespace
wrangler kv:namespace create "ANALYTICS_DATA"
```

You'll get output like:
```
Add the following to your wrangler.toml:
kv_namespaces = [
  { binding = "ANALYTICS_DATA", id = "abc123..." }
]
```

**Copy the ID** and update `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "ANALYTICS_DATA"
id = "abc123def456..."  # ← Replace with your actual ID
preview_id = "abc123def456..."  # ← Same ID for now
```

---

### **Step 6: Deploy!**

```powershell
wrangler deploy
```

You should see:
```
✨ Success! Uploaded 1 file
✨ Deployed!
  mo3taz-analytics.yourusername.workers.dev
```

---

### **Step 7: Your Analytics URL**

Your worker is now live at:
```
https://mo3taz-analytics.yourusername.workers.dev/analytics
```

**Test it:**
```powershell
# Send test event
curl -X POST https://mo3taz-analytics.yourusername.workers.dev/analytics `
  -H "Content-Type: application/json" `
  -d '{\"events\":[{\"appId\":\"test\",\"anonymousId\":\"test123\",\"event\":\"app_launch\",\"timestamp\":\"2024-01-01T00:00:00.000Z\"}]}'

# View summary
curl https://mo3taz-analytics.yourusername.workers.dev/analytics/summary
```

---

## 🔧 Configure MO3TAZ Launcher

Add to your `.env` file:

```env
MAIN_VITE_ANALYTICS_URL=https://mo3taz-analytics.yourusername.workers.dev/analytics
```

Then rebuild:

```powershell
cd D:\sdk\test\hydra
npm run build
```

---

## 📊 View Your Analytics

### **Option 1: Open Dashboard**

Open `analytics-dashboard.html` and update the URL:

```javascript
const ANALYTICS_URL = 'https://mo3taz-analytics.yourusername.workers.dev/analytics';
```

### **Option 2: Use API Endpoints**

| Endpoint | Description |
|----------|-------------|
| `GET /analytics` | View all raw data |
| `GET /analytics/summary` | Get summary statistics |
| `GET /analytics/users` | List all unique users |
| `DELETE /analytics` | Clear all data |

**Examples:**
```powershell
# View all data
curl https://mo3taz-analytics.yourusername.workers.dev/analytics

# View summary
curl https://mo3taz-analytics.yourusername.workers.dev/analytics/summary

# List users
curl https://mo3taz-analytics.yourusername.workers.dev/analytics/users
```

---

## 📝 Useful Commands

```powershell
# Test locally
wrangler dev

# View logs
wrangler tail

# Redeploy after changes
wrangler deploy

# Check usage
wrangler whoami
```

---

## 💰 Free Tier Limits

| Feature | Free Limit | Your Usage |
|---------|------------|------------|
| **Requests** | 100,000/day | ~1,000-5,000/day |
| **KV Storage** | 1GB | ~1-10MB |
| **CPU Time** | 10ms/request | ~1-2ms/request |
| **Bandwidth** | Unlimited | Minimal |

**You will NEVER hit these limits** 🎉

---

## 🔒 Security (Optional)

### Add Password Protection

Add this to the top of `src/index.ts`:

```typescript
const PASSWORD = "your-secret-password";

// Inside the fetch handler, add:
if (request.headers.get("X-Auth-Token") !== PASSWORD) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: corsHeaders,
  });
}
```

---

## 🎉 You're Done!

Your analytics server is now:
- ✅ Running 24/7 on Cloudflare's global network
- ✅ Never sleeps
- ✅ Completely FREE
- ✅ Handles up to 100k requests/day

**Next Steps:**
1. Add the URL to your `.env`
2. Rebuild your launcher
3. Start collecting data!

---

## 🛟 Troubleshooting

### **Error: "Permission denied"**
```powershell
# Run PowerShell as Administrator
wrangler deploy
```

### **Error: "KV namespace not found"**
```powershell
# Create KV namespace again
wrangler kv:namespace create "ANALYTICS_DATA"
# Update wrangler.toml with the new ID
```

### **Worker not responding?**
```powershell
# Check logs
wrangler tail

# Redeploy
wrangler deploy
```

### **Want to change the worker name?**
Edit `wrangler.toml`:
```toml
name = "my-custom-analytics"
```
Then:
```powershell
wrangler deploy
```
