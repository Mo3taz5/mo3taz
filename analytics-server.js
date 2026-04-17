const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const ANALYTICS_DIR = path.join(__dirname, 'data');
const ANALYTICS_FILE = path.join(ANALYTICS_DIR, 'analytics-data.json');

// Ensure data directory exists
if (!fs.existsSync(ANALYTICS_DIR)) {
  fs.mkdirSync(ANALYTICS_DIR, { recursive: true });
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(ANALYTICS_FILE)) {
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify({ events: [], createdAt: new Date().toISOString() }, null, 2));
}

// Receive analytics events
app.post('/analytics', (req, res) => {
  const { events } = req.body;
  
  if (!events || !Array.isArray(events)) {
    return res.status(400).json({ error: 'Invalid payload: events array required' });
  }

  try {
    // Read existing data
    const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
    
    // Add timestamp to events
    const eventsWithReceivedAt = events.map(e => ({
      ...e,
      receivedAt: new Date().toISOString(),
    }));
    
    // Append new events
    data.events.push(...eventsWithReceivedAt);
    
    // Save back to file
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(data, null, 2));
    
    console.log(`✅ Received ${events.length} analytics events (total: ${data.events.length})`);
    res.json({ success: true, count: events.length });
  } catch (error) {
    console.error('Error saving analytics data:', error);
    res.status(500).json({ error: 'Failed to save analytics data' });
  }
});

// View all analytics data
app.get('/analytics', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read analytics data' });
  }
});

// Get summary statistics
app.get('/analytics/summary', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
    
    const summary = {
      totalEvents: data.events.length,
      uniqueUsers: new Set(data.events.map(e => e.anonymousId)).size,
      dateRange: {
        from: data.createdAt,
        to: new Date().toISOString(),
      },
      eventsByType: {},
      eventsByPlatform: {},
      eventsByLanguage: {},
      appVersions: {},
      topCountries: {},
      loginStats: {
        attempts: 0,
        successes: 0,
        failures: 0,
      },
    };

    // Analyze events
    data.events.forEach(event => {
      // Count by event type
      summary.eventsByType[event.event] = (summary.eventsByType[event.event] || 0) + 1;
      
      // Count by platform
      if (event.system) {
        summary.eventsByPlatform[event.system.platform] = (summary.eventsByPlatform[event.system.platform] || 0) + 1;
      }
      
      // Count by language
      if (event.app) {
        summary.eventsByLanguage[event.app.language] = (summary.eventsByLanguage[event.app.language] || 0) + 1;
        summary.appVersions[event.app.version] = (summary.appVersions[event.app.version] || 0) + 1;
      }
      
      // Login statistics
      if (event.event === 'login_attempt') summary.loginStats.attempts++;
      if (event.event === 'login_success') summary.loginStats.successes++;
      if (event.event === 'login_failed') summary.loginStats.failures++;
    });

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

// Get users list (anonymous IDs)
app.get('/analytics/users', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(ANALYTICS_FILE, 'utf8'));
    
    const usersMap = {};
    
    data.events.forEach(event => {
      if (!usersMap[event.anonymousId]) {
        usersMap[event.anonymousId] = {
          anonymousId: event.anonymousId,
          firstSeen: event.timestamp,
          lastSeen: event.timestamp,
          eventCount: 0,
          system: event.system,
          app: event.app,
          events: [],
        };
      }
      
      usersMap[event.anonymousId].eventCount++;
      usersMap[event.anonymousId].lastSeen = event.timestamp;
      usersMap[event.anonymousId].events.push(event.event);
    });
    
    const users = Object.values(usersMap);
    
    res.json({
      total: users.length,
      users: users.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen)),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Export data
app.get('/analytics/export', (req, res) => {
  try {
    const data = fs.readFileSync(ANALYTICS_FILE, 'utf8');
    res.setHeader('Content-Disposition', 'attachment; filename=analytics-export.json');
    res.setHeader('Content-Type', 'application/json');
    res.send(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Clear data (use with caution!)
app.delete('/analytics', (req, res) => {
  try {
    fs.writeFileSync(ANALYTICS_FILE, JSON.stringify({ events: [], createdAt: new Date().toISOString() }, null, 2));
    console.log('⚠️  Analytics data cleared');
    res.json({ success: true, message: 'Analytics data cleared' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear data' });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║   📊 MO3TAZ Analytics Receiver Server                 ║
║   Running on: http://localhost:${PORT}                 ║
╠════════════════════════════════════════════════════════╣
║   POST /analytics         - Send events               ║
║   GET  /analytics         - View all data             ║
║   GET  /analytics/summary - Get summary stats         ║
║   GET  /analytics/users   - List all users            ║
║   GET  /analytics/export  - Export data as JSON       ║
║   DELETE /analytics       - Clear all data            ║
╚════════════════════════════════════════════════════════╝
  `);
});
