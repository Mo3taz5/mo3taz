# 📊 MO3TAZ Launcher - Analytics System

## Overview
Your MO3TAZ Launcher now includes an **anonymous analytics/telemetry system** that helps you understand:
- ✅ **Who uses your app** (anonymous machine fingerprints)
- ✅ **Login activity** (attempts, successes, failures)
- ✅ **App usage** (launches, closes, uptime)
- ✅ **User demographics** (location via IP, language preferences)
- ✅ **System specs** (OS, CPU, RAM, architecture)
- ✅ **Feature usage** (downloads, game launches, settings)

---

## 🎯 What Data is Collected

### Anonymous User ID
- Machine fingerprint: `anon_1a2b3c_7x8y9z`
- **NOT** personally identifiable
- Consistent for the same machine

### System Information
```json
{
  "platform": "win32",
  "arch": "x64",
  "osVersion": "Windows 10 Pro",
  "totalMemoryGB": 16,
  "cpuModel": "Intel i7-9700K",
  "cpuCores": 8
}
```

### Events Tracked
| Event | Description |
|-------|-------------|
| `app_launch` | App started |
| `app_close` | App closed |
| `login_attempt` | Login attempted (email hashed) |
| `login_success` | Successful login (profile ID, username) |
| `login_failed` | Failed login (error message) |
| `sign_out` | User signed out |
| `game_launch` | Game launched |
| `game_download` | Download started |
| `language_detected` | IP-based language detection |

---

## 🚀 Quick Start

### Step 1: Set Up Analytics Server

You have two options:

#### Option A: Use the Included Simple Server

```bash
# Install dependencies
cd D:\sdk\test\hydra
npm install express cors --save

# Run the analytics server
node analytics-server.js
```

This runs a local server on `http://localhost:3001` that stores data in a JSON file.

#### Option B: Use a Cloud Service (Recommended for Production)

Services like:
- **PostHog** - Open source, self-hosted: https://posthog.com
- **Plausible** - Privacy-focused: https://plausible.io
- **Mixpanel** - Free tier available: https://mixpanel.com

### Step 2: Configure Environment

Add to your `.env` file:

```env
# For local testing
MAIN_VITE_ANALYTICS_URL=http://localhost:3001/analytics

# For production (replace with your actual server)
MAIN_VITE_ANALYTICS_URL=https://your-analytics-server.com/analytics
```

### Step 3: Build and Deploy

```bash
npm run build
```

The analytics system is now active and will start collecting data!

---

## 📈 Viewing Your Analytics

### If Using the Included Server:

| Endpoint | Description |
|----------|-------------|
| `http://localhost:3001/analytics` | View all raw events |
| `http://localhost:3001/analytics/summary` | Get summary statistics |
| `http://localhost:3001/analytics/users` | List all unique users |
| `http://localhost:3001/analytics/export` | Export data as JSON |
| `DELETE http://localhost:3001/analytics` | Clear all data |

### Example Summary Response:

```json
{
  "totalEvents": 1523,
  "uniqueUsers": 342,
  "eventsByType": {
    "app_launch": 450,
    "login_success": 380,
    "login_failed": 45,
    "game_launch": 648
  },
  "eventsByPlatform": {
    "win32": 1200,
    "linux": 250,
    "darwin": 73
  },
  "eventsByLanguage": {
    "en": 800,
    "pt-BR": 350,
    "de": 180,
    "fr": 193
  },
  "loginStats": {
    "attempts": 425,
    "successes": 380,
    "failures": 45
  }
}
```

---

## 🔒 Privacy & Security

### ✅ What is NOT Collected:
- ❌ Email addresses (only SHA hash)
- ❌ Passwords
- ❌ Personal information
- ❌ File contents
- ❌ Game files
- ❌ Payment information

### ✅ What IS Collected:
- ✅ Anonymous machine ID
- ✅ System specs (OS, CPU, RAM)
- ✅ App version and language
- ✅ Event timestamps
- ✅ Event types

---

## 📁 Files Added/Modified

### New Files:
1. **`src/main/services/analytics.service.ts`** - Core analytics service
2. **`src/main/events/analytics/track-event.ts`** - IPC handlers
3. **`src/renderer/src/services/ip-language.service.ts`** - IP-based language detection
4. **`src/renderer/src/helpers/ip-language-detector.ts`** - Country-to-language mapping
5. **`analytics-server.js`** - Simple analytics receiver server
6. **`ANALYTICS_SETUP.md`** - Detailed setup guide

### Modified Files:
1. **`src/main/index.ts`** - App launch/close tracking
2. **`src/main/services/hydra-api.ts`** - Login event tracking
3. **`src/main/events/index.ts`** - Register analytics IPC
4. **`src/renderer/src/main.tsx`** - IP-based language detection
5. **`src/renderer/src/app.tsx`** - Sign in/out tracking
6. **`src/preload/index.ts`** - Expose analytics API
7. **`src/renderer/src/declaration.d.ts`** - TypeScript types

---

## 🎨 Use Cases

### 1. Understand Your User Base
```bash
curl http://localhost:3001/analytics/users
```
See how many unique users you have, their systems, and activity.

### 2. Track Login Success Rate
View `/analytics/summary` to see:
- Total login attempts
- Success vs failure rate
- Common error messages

### 3. Language Distribution
Know which languages your users prefer based on their IP location.

### 4. App Version Adoption
Track how many users have updated to the latest version.

### 5. Platform Distribution
See breakdown of Windows vs Linux vs macOS users.

---

## 🛠 Advanced Usage

### Custom Event Tracking

You can track custom events anywhere in the code:

**Main Process:**
```typescript
import { AnalyticsService, AnalyticsEvent } from "@main/services";

const analytics = AnalyticsService.getInstance();
await analytics.track(AnalyticsEvent.SettingsOpen, { page: "account" });
```

**Renderer Process:**
```typescript
window.electron.analytics.track("custom_event", {
  customProperty: "value",
});
```

### Batch Processing
Events are automatically batched and sent in groups of 10 to avoid overwhelming your server.

### Offline Handling
Events are queued if your analytics server is unreachable and retried automatically.

---

## 📊 Building a Dashboard

You can build a simple dashboard using the summary endpoint:

```javascript
// Fetch summary every 30 seconds
setInterval(async () => {
  const response = await fetch('http://localhost:3001/analytics/summary');
  const summary = await response.json();
  
  console.log(`Active Users: ${summary.uniqueUsers}`);
  console.log(`Login Success Rate: ${(summary.loginStats.successes / summary.loginStats.attempts * 100).toFixed(1)}%`);
  console.log(`Top Platform: ${Object.entries(summary.eventsByPlatform).sort((a,b) => b[1] - a[1])[0][0]}`);
}, 30000);
```

---

## 🔧 Troubleshooting

### Analytics Not Working?

1. **Check the URL**: Ensure `MAIN_VITE_ANALYTICS_URL` is set correctly
2. **Check CORS**: If using a custom server, enable CORS
3. **Check logs**: Look for `[Analytics]` messages in the app logs

### Test Locally:

```bash
# Test your analytics server
curl -X POST http://localhost:3001/analytics \
  -H "Content-Type: application/json" \
  -d '{"events":[{"appId":"test","anonymousId":"test123","event":"app_launch","timestamp":"2024-01-01T00:00:00.000Z"}]}'
```

---

## 📝 Notes

- **Performance Impact**: Minimal - analytics are sent asynchronously in the background
- **Storage**: Events are queued and batched to minimize network requests
- **Reliability**: Multiple fallback services for IP detection
- **Privacy**: All data is anonymous and cannot identify individual users

---

## 🎉 You're All Set!

Your MO3TAZ Launcher now collects valuable anonymous data to help you understand your users better. 

**Next Steps:**
1. Set up your analytics server (local or cloud)
2. Add the URL to your `.env` file
3. Rebuild your app
4. Start collecting insights!

For detailed setup instructions, see [`ANALYTICS_SETUP.md`](ANALYTICS_SETUP.md)
