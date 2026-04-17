# Analytics Receiver Setup Guide

## Overview
The MO3TAZ Launcher now sends anonymous telemetry data to help you understand:
- Who is using your app (anonymous machine IDs)
- When users launch/close the app
- Login attempts (success/failure)
- User system information (OS, CPU, memory)
- App version and language preferences

## What Data is Sent

### Anonymous Identifier
- `anonymousId`: A unique machine fingerprint (not personally identifiable)
- Example: `anon_1a2b3c_7x8y9z`

### System Information
```json
{
  "platform": "win32",
  "arch": "x64", 
  "osVersion": "Windows 10 Pro",
  "osRelease": "10.0.19045",
  "totalMemoryGB": 16,
  "cpuModel": "Intel(R) Core(TM) i7-9700K",
  "cpuCores": 8
}
```

### App Information
```json
{
  "version": "0.35.0",
  "language": "en",
  "isDev": false,
  "uptime": 3600
}
```

### Events Tracked
- `app_launch` - When the app starts
- `app_close` - When the app closes
- `login_attempt` - Login attempt (with hashed email)
- `login_success` - Successful login (with profile ID & username)
- `login_failed` - Failed login (with error message)
- `sign_out` - User signs out
- `game_launch` - When a game is launched
- `game_download` - When a download starts
- `settings_open` - When settings is opened
- `theme_change` - When theme is changed
- `language_change` - When language is changed
- `external_auth` - External authentication
- `library_import` - Library import events

## Setting Up Your Analytics Receiver

### Option 1: Simple Node.js/Express Server

```javascript
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const ANALYTICS_FILE = path.join(__dirname, 'analytics-data.json');

// Initialize data file
if (!fs.existsSync(ANALYTICS_FILE)) {
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify({ events: [] }));
}

app.post('/analytics', (req, res) => {
  const { events } = req.body;
  
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  // Read existing data
  const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
  
  // Append new events
  data.events.push(...events);
  
  // Save back to file
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
  
  console.log(`Received ${events.length} analytics events`);
  res.json({ success: true });
});

// Endpoint to view analytics
app.get('/analytics', (req, res) => {
  const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
  res.json(data);
});

// Endpoint to get summary statistics
app.get('/analytics/summary', (req, res) => {
  const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
  
  const summary = {
    totalEvents: data.events.length,
    uniqueUsers: new Set(data.events.map(e => e.anonymousId)).size,
    eventsByType: {},
    eventsByPlatform: {},
    eventsByLanguage: {},
    appVersions: {},
  };

  // Count by event type
  data.events.forEach(event => {
    summary.eventsByType[event.event] = (summary.eventsByType[event.event] || 0) + 1;
    summary.eventsByPlatform[event.system.platform] = (summary.eventsByPlatform[event.system.platform] || 0) + 1;
    summary.eventsByLanguage[event.app.language] = (summary.eventsByLanguage[event.app.language] || 0) + 1;
    summary.appVersions[event.app.version] = (summary.appVersions[event.app.version] || 0) + 1;
  });

  res.json(summary);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Analytics receiver running on port ${PORT}`);
});
```

### Option 2: Use Existing Services

You can also use existing analytics services:

1. **PostHog** (Open source, self-hosted)
   - URL: `https://posthog.com`
   - Set `MAIN_VITE_ANALYTICS_URL` to your PostHog endpoint

2. **Plausible Analytics** (Privacy-focused)
   - URL: `https://plausible.io`

3. **Google Analytics** (Free, cloud-hosted)
   - More complex setup required

## Configuration

Add to your `.env` file:

```env
# Analytics receiver endpoint
MAIN_VITE_ANALYTICS_URL=https://your-analytics-server.com/analytics
```

## Privacy Considerations

✅ **What is NOT collected:**
- Email addresses (only hashed)
- Passwords
- Personal information
- File contents
- Game files

✅ **What IS collected:**
- Anonymous machine identifier
- System specs (OS, CPU, RAM)
- App version and language
- Event timestamps
- Event types (login, launch, etc.)

## Viewing Your Analytics

Once data is collected, you can:

1. **View raw data**: Access `/analytics` endpoint
2. **View summary**: Access `/analytics/summary` endpoint
3. **Build a dashboard**: Use the data to create visualizations

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
  "appVersions": {
    "0.35.0": 1200,
    "0.34.0": 323
  }
}
```

## Next Steps

1. Set up your analytics receiver server
2. Add the URL to your `.env` file
3. Deploy and monitor your analytics dashboard
4. Use the data to understand your user base better
