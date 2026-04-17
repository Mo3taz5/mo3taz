// Cloudflare Worker - MO3TAZ Analytics Receiver
// Deploy with: wrangler deploy

interface AnalyticsEvent {
  appId: string;
  anonymousId: string;
  event: string;
  timestamp: string;
  system?: {
    platform: string;
    arch: string;
    osVersion: string;
    totalMemoryGB: number;
    cpuModel: string;
    cpuCores: number;
  };
  app?: {
    version: string;
    language: string;
    isDev: boolean;
    uptime: number;
  };
  metadata?: Record<string, any>;
  receivedAt?: string;
}

interface AnalyticsData {
  events: AnalyticsEvent[];
  createdAt: string;
  lastUpdated: string;
}

// Cloudflare KV binding - stores analytics data
declare const ANALYTICS_DATA: KVNamespace;

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, DELETE',
      'Content-Type': 'application/json',
    };

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders, status: 204 });
    }

    try {
      // POST - Receive analytics events
      if (method === 'POST' && path === '/analytics') {
        const body = await request.json();
        const { events } = body as { events?: AnalyticsEvent[] };

        if (!events || !Array.isArray(events)) {
          return new Response(
            JSON.stringify({ error: 'Invalid payload: events array required' }),
            {
              status: 400,
              headers: corsHeaders,
            }
          );
        }

        // Get existing data or initialize
        let data: AnalyticsData;
        const existing = await env.ANALYTICS_DATA.get('analytics', 'json');
        
        if (existing) {
          data = existing as AnalyticsData;
        } else {
          data = {
            events: [],
            createdAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
          };
        }

        // Add timestamp and append events
        const eventsWithTimestamp = events.map(e => ({
          ...e,
          receivedAt: new Date().toISOString(),
        }));

        data.events.push(...eventsWithTimestamp);
        data.lastUpdated = new Date().toISOString();

        // Save to KV store
        await env.ANALYTICS_DATA.put('analytics', JSON.stringify(data));

        console.log(`Received ${events.length} events (total: ${data.events.length})`);

        return new Response(
          JSON.stringify({ success: true, count: events.length }),
          { headers: corsHeaders }
        );
      }

      // GET - Return all analytics data
      if (method === 'GET' && path === '/analytics') {
        const data = await env.ANALYTICS_DATA.get('analytics', 'json');
        
        if (!data) {
          return new Response(
            JSON.stringify({ events: [], message: 'No data yet' }),
            { headers: corsHeaders }
          );
        }

        return new Response(JSON.stringify(data), { headers: corsHeaders });
      }

      // GET - Return summary statistics
      if (method === 'GET' && path === '/analytics/summary') {
        const existing = await env.ANALYTICS_DATA.get('analytics', 'json');
        
        if (!existing) {
          return new Response(
            JSON.stringify({
              totalEvents: 0,
              uniqueUsers: 0,
              eventsByType: {},
              eventsByPlatform: {},
              eventsByLanguage: {},
              appVersions: {},
              loginStats: { attempts: 0, successes: 0, failures: 0 },
            }),
            { headers: corsHeaders }
          );
        }

        const data = existing as AnalyticsData;

        // Calculate summary
        const summary = {
          totalEvents: data.events.length,
          uniqueUsers: new Set(data.events.map(e => e.anonymousId)).size,
          dateRange: {
            from: data.createdAt,
            to: data.lastUpdated,
          },
          eventsByType: {} as Record<string, number>,
          eventsByPlatform: {} as Record<string, number>,
          eventsByLanguage: {} as Record<string, number>,
          appVersions: {} as Record<string, number>,
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
            summary.eventsByPlatform[event.system.platform] = 
              (summary.eventsByPlatform[event.system.platform] || 0) + 1;
          }
          
          // Count by language
          if (event.app) {
            summary.eventsByLanguage[event.app.language] = 
              (summary.eventsByLanguage[event.app.language] || 0) + 1;
            summary.appVersions[event.app.version] = 
              (summary.appVersions[event.app.version] || 0) + 1;
          }
          
          // Login statistics
          if (event.event === 'login_attempt') summary.loginStats.attempts++;
          if (event.event === 'login_success') summary.loginStats.successes++;
          if (event.event === 'login_failed') summary.loginStats.failures++;
        });

        return new Response(JSON.stringify(summary), { headers: corsHeaders });
      }

      // GET - List unique users
      if (method === 'GET' && path === '/analytics/users') {
        const existing = await env.ANALYTICS_DATA.get('analytics', 'json');
        
        if (!existing) {
          return new Response(JSON.stringify({ total: 0, users: [] }), {
            headers: corsHeaders,
          });
        }

        const data = existing as AnalyticsData;
        const usersMap = new Map<string, any>();

        data.events.forEach(event => {
          if (!usersMap.has(event.anonymousId)) {
            usersMap.set(event.anonymousId, {
              anonymousId: event.anonymousId,
              firstSeen: event.timestamp,
              lastSeen: event.timestamp,
              eventCount: 0,
              system: event.system,
              app: event.app,
              events: [],
            });
          }

          const user = usersMap.get(event.anonymousId);
          user.eventCount++;
          user.lastSeen = event.timestamp;
          user.events.push(event.event);
        });

        const users = Array.from(usersMap.values())
          .sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());

        return new Response(
          JSON.stringify({ total: users.length, users }),
          { headers: corsHeaders }
        );
      }

      // DELETE - Clear all data (use with caution!)
      if (method === 'DELETE' && path === '/analytics') {
        await env.ANALYTICS_DATA.put('analytics', JSON.stringify({
          events: [],
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        }));

        return new Response(
          JSON.stringify({ success: true, message: 'Analytics data cleared' }),
          { headers: corsHeaders }
        );
      }

      // 404 for unknown routes
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { status: 404, headers: corsHeaders }
      );

    } catch (error) {
      console.error('Error:', error);
      return new Response(
        JSON.stringify({ error: 'Internal server error' }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};
