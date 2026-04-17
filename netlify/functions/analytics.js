// Netlify Function - Receives analytics events
// Deploy to Netlify for FREE

const path = require('path');
const fs = require('fs').promises;

// Data file (stored in Netlify's build directory)
const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'analytics-data.json');

// Ensure data directory exists
async function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Initialize data file
async function initDataFile() {
  await ensureDataDir();
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({
      events: [],
      createdAt: new Date().toISOString()
    }, null, 2));
  }
}

// Read data
async function readData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { events: [], createdAt: new Date().toISOString() };
  }
}

// Write data
async function writeData(data) {
  await ensureDataDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

exports.handler = async (event) => {
  await initDataFile();

  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  // POST - Receive events
  if (event.httpMethod === 'POST') {
    try {
      const { events } = JSON.parse(event.body);
      
      if (!events || !Array.isArray(events)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid payload' }),
        };
      }

      const data = await readData();
      const eventsWithTimestamp = events.map(e => ({
        ...e,
        receivedAt: new Date().toISOString(),
      }));
      
      data.events.push(...eventsWithTimestamp);
      await writeData(data);

      console.log(`Received ${events.length} events (total: ${data.events.length})`);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, count: events.length }),
      };
    } catch (error) {
      console.error('Error:', error);
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'Failed to save data' }),
      };
    }
  }

  // GET - Return data or summary
  if (event.httpMethod === 'GET') {
    const data = await readData();
    
    // Check if summary requested
    if (event.path.includes('/summary')) {
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
        loginStats: {
          attempts: 0,
          successes: 0,
          failures: 0,
        },
      };

      data.events.forEach(event => {
        summary.eventsByType[event.event] = (summary.eventsByType[event.event] || 0) + 1;
        if (event.system) {
          summary.eventsByPlatform[event.system.platform] = (summary.eventsByPlatform[event.system.platform] || 0) + 1;
        }
        if (event.app) {
          summary.eventsByLanguage[event.app.language] = (summary.eventsByLanguage[event.app.language] || 0) + 1;
          summary.appVersions[event.app.version] = (summary.appVersions[event.app.version] || 0) + 1;
        }
        if (event.event === 'login_attempt') summary.loginStats.attempts++;
        if (event.event === 'login_success') summary.loginStats.successes++;
        if (event.event === 'login_failed') summary.loginStats.failures++;
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(summary),
      };
    }

    // Return all data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data),
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ error: 'Method not allowed' }),
  };
};
