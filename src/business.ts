import express, { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { optionalEnv, requiredEnv } from './config.js';
import { registerBusinessTools } from './business-tools.js';
import { authenticateBearer, type BusinessIdentity } from './security.js';

const hostAllowlist = new Set(requiredEnv('BUSINESS_ALLOWED_HOSTS').split(',').map((host) => host.trim().toLowerCase()).filter(Boolean));
const originAllowlist = new Set((optionalEnv('BUSINESS_ALLOWED_ORIGINS') ?? '').split(',').map((origin) => origin.trim()).filter(Boolean));
const app = express();
const ipLimit = Number(process.env.BUSINESS_RATE_LIMIT_PER_MINUTE ?? 60);
const userLimit = Number(process.env.BUSINESS_USER_RATE_LIMIT_PER_MINUTE ?? 60);
const globalLimit = Number(process.env.BUSINESS_GLOBAL_RATE_LIMIT_PER_MINUTE ?? 300);
const windows = new Map<string, { start: number; count: number }>();

app.disable('x-powered-by');
app.use((req, res, next) => {
  const host = (req.headers.host ?? '').toLowerCase().split(':')[0];
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
  const ip = req.socket.remoteAddress ?? 'unknown';
  if (!takeRateLimit('global', globalLimit, now) || !takeRateLimit(`ip:${ip}`, ipLimit, now)) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  if (windows.size > 10_000) {
    for (const [id, item] of windows) if (now - item.start >= 60_000) windows.delete(id);
  }
  return next();
}

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.all('/mcp', rateLimit, async (req, res) => {
  let identity: BusinessIdentity;
  try {
    identity = await authenticateBearer(req.header('authorization'));
  } catch {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!takeRateLimit(`user:${identity.subject}`, userLimit, Date.now())) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  const server = new McpServer({ name: 'ulter-net-business', version: '0.1.0' }, { maxToolInputElements: 100 });
  registerBusinessTools(server, identity, randomUUID());
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('finish', () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' });
    void transport.close();
    void server.close();
  }
});

const port = Number(process.env.PORT ?? process.env.BUSINESS_PORT ?? 8787);
const host = process.env.BUSINESS_HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('BUSINESS_PORT must be a valid TCP port');
app.listen(port, host, () => {
  process.stderr.write(`MCP1 business service listening on ${host}:${port}\n`);
});
