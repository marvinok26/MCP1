import express, { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { optionalEnv, requiredEnv } from './config.js';
import { registerBusinessTools } from './business-tools.js';
import { authenticateBearer, type BusinessIdentity } from './security.js';

export function createBusinessApp(authenticate: (header: string | undefined) => Promise<BusinessIdentity> = authenticateBearer) {
  const hostAllowlist = new Set(requiredEnv('BUSINESS_ALLOWED_HOSTS').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
  const originAllowlist = new Set((optionalEnv('BUSINESS_ALLOWED_ORIGINS') ?? '').split(',').map((origin) => origin.trim()).filter(Boolean));
  const oauthDiscoveryEnabled = process.env.BUSINESS_OAUTH_DISCOVERY_ENABLED === 'true';
  const resourceUrl = oauthDiscoveryEnabled ? new URL(requiredEnv('BUSINESS_RESOURCE_URL')) : undefined;
  const issuerUrl = oauthDiscoveryEnabled ? new URL(requiredEnv('BUSINESS_ISSUER_URL')) : undefined;
  if (oauthDiscoveryEnabled && (!resourceUrl || !issuerUrl || resourceUrl.protocol !== 'https:' || issuerUrl.protocol !== 'https:' || resourceUrl.username || resourceUrl.password || resourceUrl.search || resourceUrl.hash || issuerUrl.username || issuerUrl.password || issuerUrl.search || issuerUrl.hash || resourceUrl.pathname !== '/mcp' || !hostAllowlist.has(resourceUrl.hostname.toLowerCase()))) {
    throw new Error('OAuth discovery requires HTTPS resource and issuer URLs and a resource URL on an allowed host ending in /mcp');
  }
  const resourceMetadataUrl = resourceUrl ? `${resourceUrl.origin}/.well-known/oauth-protected-resource` : undefined;
  const app = express();
  const ipLimit = Number(process.env.BUSINESS_RATE_LIMIT_PER_MINUTE ?? 60);
  const userLimit = Number(process.env.BUSINESS_USER_RATE_LIMIT_PER_MINUTE ?? 60);
  const globalLimit = Number(process.env.BUSINESS_GLOBAL_RATE_LIMIT_PER_MINUTE ?? 300);
  const windows = new Map<string, { start: number; count: number }>();
  app.locals.mcpReady = true;

  app.disable('x-powered-by');
  if (process.env.BUSINESS_TRUST_PROXY === 'true') app.set('trust proxy', 'loopback');
  app.use((req, res, next) => {
    const host = (req.headers.host ?? '').toLowerCase().split(':')[0] ?? '';
    if (!hostAllowlist.has(host)) return res.status(421).json({ error: 'Unknown host' });
    const origin = req.headers.origin;
    if (origin && !originAllowlist.has(origin)) return res.status(403).json({ error: 'Origin not allowed' });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id');
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
  });
  app.use(express.json({ limit: '1mb', strict: true }));

  function takeRateLimit(key: string, limit: number, now: number): boolean {
    let bucket = windows.get(key);
    if (!bucket || now - bucket.start >= 60_000) {
      bucket = { start: now, count: 0 };
      windows.set(key, bucket);
    }
    bucket.count += 1;
    return bucket.count <= limit;
  }

  function rateLimit(req: Request, res: Response, next: NextFunction) {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!takeRateLimit('global', globalLimit, now) || !takeRateLimit(`ip:${ip}`, ipLimit, now)) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
    if (windows.size > 10_000) {
      for (const [id, item] of windows) if (now - item.start >= 60_000) windows.delete(id);
    }
    return next();
  }

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', (_req, res) => app.locals.mcpReady
    ? res.json({ status: 'ready' })
    : res.status(503).json({ status: 'not_ready' }));
  app.get('/.well-known/oauth-protected-resource', (_req, res) => {
    if (!resourceUrl || !issuerUrl) return res.status(404).json({ error: 'Not found' });
    return res.json({
      resource: resourceUrl.href,
      authorization_servers: [issuerUrl.href],
      bearer_methods_supported: ['header'],
      scopes_supported: ['mcp:systems:list', ...['ulterpos', 'tranquil', 'ulternet', 'social-apps', 'renegade'].flatMap((system) => [`system:${system}:health:read`, `system:${system}:marketing:read`])],
    });
  });
  app.all('/mcp', (req, res, next) => app.locals.mcpReady
    ? next()
    : res.status(503).json({ error: 'Service is shutting down' }), rateLimit, async (req, res) => {
    let identity: BusinessIdentity;
    try {
      identity = await authenticate(req.header('authorization'));
    } catch {
      res.setHeader('WWW-Authenticate', resourceMetadataUrl
        ? `Bearer resource_metadata="${resourceMetadataUrl}"`
        : 'Bearer');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!takeRateLimit(`user:${identity.subject}`, userLimit, Date.now())) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const server = new McpServer({ name: 'ulter-net-business', version: '0.1.0' }, { maxToolInputElements: 100 });
    registerBusinessTools(server, identity, randomUUID());
    const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
    res.on('finish', () => {
      void transport.close();
      void server.close();
    });
    try {
      // The SDK transport getter exposes undefined for an optional callback; bridge its type here.
      await server.connect(transport as unknown as Transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' });
      void transport.close();
      void server.close();
    }
  });

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(error);
    const details = error as { status?: number; statusCode?: number; type?: string };
    const status = details.statusCode === 413 || details.status === 413 ? 413 : details.type === 'entity.parse.failed' ? 400 : 500;
    return res.status(status).json({ error: status === 413 ? 'Request too large' : status === 400 ? 'Malformed JSON request' : 'Request failed' });
  });

  return app;
}
