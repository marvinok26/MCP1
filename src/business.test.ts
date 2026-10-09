import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer, request as httpRequest } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createBusinessApp } from './business.js';
import type { BusinessIdentity } from './security.js';

function setEnv(name: string, value: string | undefined): () => void {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
  return () => {
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  };
}

function getWithHost(url: string, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { headers: { host }, setHost: false }, (response) => {
      response.resume();
      response.on('end', () => resolve(response.statusCode ?? 0));
    });
    request.on('error', reject);
    request.end();
  });
}

test('HTTP boundary enforces host/origin policy and gives generic parser errors', async () => {
  const restore = [
    setEnv('BUSINESS_ALLOWED_HOSTS', '127.0.0.1'),
    setEnv('BUSINESS_ALLOWED_ORIGINS', 'https://staff.example.test'),
    setEnv('BUSINESS_RATE_LIMIT_PER_MINUTE', '20'),
    setEnv('BUSINESS_USER_RATE_LIMIT_PER_MINUTE', '20'),
    setEnv('BUSINESS_GLOBAL_RATE_LIMIT_PER_MINUTE', '50'),
  ];
  const app = createBusinessApp(async () => ({ subject: 'test-user', scopes: new Set() }));
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    assert.equal(await getWithHost(`${baseUrl}/healthz`, 'untrusted.example.test'), 421);
    const badOrigin = await fetch(`${baseUrl}/healthz`, { headers: { origin: 'https://attacker.example.test' } });
    assert.equal(badOrigin.status, 403);
    const preflight = await fetch(`${baseUrl}/mcp`, {
      method: 'OPTIONS',
      headers: { origin: 'https://staff.example.test', 'access-control-request-method': 'POST' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://staff.example.test');
    const malformed = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
      body: '{',
    });
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: 'Malformed JSON request' });
  } finally {
    listener.close();
    await once(listener, 'close');
    restore.reverse().forEach((fn) => fn());
  }
});

test('readiness follows listener lifecycle while liveness stays available during drain', async () => {
  const restore = setEnv('BUSINESS_ALLOWED_HOSTS', '127.0.0.1');
  const app = createBusinessApp(async () => ({ subject: 'readiness-user', scopes: new Set() }));
  app.locals.mcpReady = false;
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    assert.equal((await fetch(`${baseUrl}/healthz`)).status, 200);
    assert.equal((await fetch(`${baseUrl}/readyz`)).status, 503);
    assert.equal((await fetch(`${baseUrl}/mcp`)).status, 503);
    app.locals.mcpReady = true;
    assert.equal((await fetch(`${baseUrl}/readyz`)).status, 200);
    app.locals.mcpReady = false;
    assert.equal((await fetch(`${baseUrl}/mcp`)).status, 503);
  } finally {
    listener.close();
    await once(listener, 'close');
    restore();
  }
});

test('Streamable HTTP exposes scoped tools and writes redacted audit records', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'mcp1-audit-'));
  const previousAudit = setEnv('AUDIT_LOG_PATH', path.join(temp, 'audit.jsonl'));
  const restore = [
    setEnv('BUSINESS_ALLOWED_HOSTS', '127.0.0.1'),
    setEnv('BUSINESS_ALLOWED_ORIGINS', undefined),
    setEnv('BUSINESS_RATE_LIMIT_PER_MINUTE', '40'),
    setEnv('BUSINESS_USER_RATE_LIMIT_PER_MINUTE', '40'),
    setEnv('BUSINESS_GLOBAL_RATE_LIMIT_PER_MINUTE', '80'),
    setEnv('SYSTEM_ULTERPOS_HEALTH_URL', undefined),
  ];
  const allowedIdentity: BusinessIdentity = { subject: 'staff-42', scopes: new Set(['mcp:systems:list']) };
  const authenticate = async (header: string | undefined) => {
    if (header !== 'Bearer integration-test-token') throw new Error('invalid token');
    return allowedIdentity;
  };
  const app = createBusinessApp(authenticate);
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`), {
    requestInit: { headers: { authorization: 'Bearer integration-test-token' } },
  });
  const client = new Client({ name: 'mcp1-tests', version: '0.1.0' });

  try {
    await client.connect(transport as unknown as Transport);
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ['business_system_health', 'business_systems_list', 'marketing_channel_summary', 'marketing_landing_pages', 'marketing_search_performance']);

    const list = await client.callTool({ name: 'business_systems_list', arguments: {} });
    assert.equal(list.isError, undefined);
    const content = list.content as Array<{ type?: string; text?: string }>;
    assert.deepEqual(JSON.parse(content[0]?.text ?? 'null'), [
      { key: 'ulterpos', name: 'UlterPOS' },
      { key: 'tranquil', name: 'Tranquil Pharmacy' },
      { key: 'ulternet', name: 'UlterNet website' },
      { key: 'social-apps', name: 'Social apps' },
      { key: 'renegade', name: 'Renegade Tickets & Events' },
    ]);

    const denied = await client.callTool({ name: 'business_system_health', arguments: { system: 'ulterpos' } });
    assert.equal(denied.isError, true);

    const audit = await readFile(path.join(temp, 'audit.jsonl'), 'utf8');
    const events = audit.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.equal(events.length, 2);
    assert.equal(events[0]?.actor, 'staff-42');
    assert.equal(events[0]?.tool, 'business_systems_list');
    assert.equal(events[1]?.outcome, 'denied');
    assert.equal(audit.includes('integration-test-token'), false);
    assert.equal(audit.includes('authorization'), false);
  } finally {
    await client.close();
    listener.close();
    await once(listener, 'close');
    restore.reverse().forEach((fn) => fn());
    previousAudit();
    await rm(temp, { recursive: true, force: true });
  }
});

test('business Streamable HTTP enforces signed-token claims and tool scopes end to end', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const publicJwk = { ...await exportJWK(publicKey), kid: 'http-test-key', use: 'sig', alg: 'RS256' };
  const jwksServer = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'public, max-age=60');
    res.end(JSON.stringify({ keys: [publicJwk] }));
  });
  jwksServer.listen(0, '127.0.0.1');
  await once(jwksServer, 'listening');
  const jwksAddress = jwksServer.address();
  assert.ok(jwksAddress && typeof jwksAddress !== 'string');

  const restore = [
    setEnv('BUSINESS_ALLOWED_HOSTS', '127.0.0.1'),
    setEnv('BUSINESS_ALLOWED_ORIGINS', undefined),
    setEnv('BUSINESS_ISSUER_URL', 'https://identity.example.test/'),
    setEnv('BUSINESS_AUDIENCE', 'https://mcp.example.test'),
    setEnv('BUSINESS_JWKS_URL', `http://127.0.0.1:${jwksAddress.port}/jwks`),
    setEnv('BUSINESS_RATE_LIMIT_PER_MINUTE', '40'),
    setEnv('BUSINESS_USER_RATE_LIMIT_PER_MINUTE', '40'),
    setEnv('BUSINESS_GLOBAL_RATE_LIMIT_PER_MINUTE', '80'),
    setEnv('SYSTEM_ULTERPOS_HEALTH_URL', undefined),
  ];
  const app = createBusinessApp();
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const endpoint = new URL(`http://127.0.0.1:${address.port}/mcp`);

  const sign = async (options: { audience?: string; expiresAt?: number; scope?: string } = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ scope: options.scope ?? 'mcp:systems:list' })
      .setProtectedHeader({ alg: 'RS256', kid: 'http-test-key' })
      .setSubject('http-staff-9')
      .setIssuer('https://identity.example.test/')
      .setAudience(options.audience ?? 'https://mcp.example.test')
      .setIssuedAt(now)
      .setExpirationTime(options.expiresAt ?? now + 60)
      .sign(privateKey);
  };

  async function initialize(token: string): Promise<Response> {
    return fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'mcp1-auth-test', version: '0.1.0' },
      } }),
    });
  }

  try {
    const expired = await initialize(await sign({ expiresAt: Math.floor(Date.now() / 1000) - 1 }));
    assert.equal(expired.status, 401);
    await expired.body?.cancel();
    const wrongAudience = await initialize(await sign({ audience: 'https://other.example.test' }));
    assert.equal(wrongAudience.status, 401);
    await wrongAudience.body?.cancel();

    const transport = new StreamableHTTPClientTransport(endpoint, {
      requestInit: { headers: { authorization: `Bearer ${await sign()}` } },
    });
    const client = new Client({ name: 'mcp1-e2e-auth', version: '0.1.0' });
    try {
      await client.connect(transport as unknown as Transport);
      const { tools } = await client.listTools();
      assert.deepEqual(tools.map((tool) => tool.name).sort(), ['business_system_health', 'business_systems_list', 'marketing_channel_summary', 'marketing_landing_pages', 'marketing_search_performance']);
      const systems = await client.callTool({ name: 'business_systems_list', arguments: {} });
      assert.equal(systems.isError, undefined);
      assert.deepEqual(JSON.parse(((systems.content as Array<{ text?: string }>)[0])?.text ?? 'null'), [
        { key: 'ulterpos', name: 'UlterPOS' },
        { key: 'tranquil', name: 'Tranquil Pharmacy' },
        { key: 'ulternet', name: 'UlterNet website' },
        { key: 'social-apps', name: 'Social apps' },
        { key: 'renegade', name: 'Renegade Tickets & Events' },
      ]);
      const denied = await client.callTool({ name: 'business_system_health', arguments: { system: 'ulterpos' } });
      assert.equal(denied.isError, true);
    } finally {
      await client.close();
    }
  } finally {
    listener.close();
    await once(listener, 'close');
    jwksServer.close();
    await once(jwksServer, 'close');
    restore.reverse().forEach((fn) => fn());
  }
});

test('business HTTP rate limit rejects repeated unauthenticated requests', async () => {
  const restore = [
    setEnv('BUSINESS_ALLOWED_HOSTS', '127.0.0.1'),
    setEnv('BUSINESS_ALLOWED_ORIGINS', undefined),
    setEnv('BUSINESS_RATE_LIMIT_PER_MINUTE', '2'),
    setEnv('BUSINESS_USER_RATE_LIMIT_PER_MINUTE', '20'),
    setEnv('BUSINESS_GLOBAL_RATE_LIMIT_PER_MINUTE', '20'),
  ];
  const app = createBusinessApp(async () => { throw new Error('not authenticated'); });
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}/mcp`;

  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url)).status, 429);
  } finally {
    listener.close();
    await once(listener, 'close');
    restore.reverse().forEach((fn) => fn());
  }
});

test('health-check circuit opens after five downstream failures', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'mcp1-circuit-'));
  const previousAudit = setEnv('AUDIT_LOG_PATH', path.join(temp, 'audit.jsonl'));
  const restore = [
    setEnv('BUSINESS_ALLOWED_HOSTS', '127.0.0.1'),
    setEnv('BUSINESS_ALLOWED_ORIGINS', undefined),
    setEnv('BUSINESS_RATE_LIMIT_PER_MINUTE', '40'),
    setEnv('BUSINESS_USER_RATE_LIMIT_PER_MINUTE', '40'),
    setEnv('BUSINESS_GLOBAL_RATE_LIMIT_PER_MINUTE', '80'),
    setEnv('SYSTEM_ULTERPOS_HEALTH_URL', 'https://health.example.test/healthz'),
    setEnv('SYSTEM_ULTERPOS_HEALTH_TOKEN', undefined),
  ];
  const originalFetch = globalThis.fetch;
  let downstreamCalls = 0;
  globalThis.fetch = async (input, init) => {
    const requestedUrl = input instanceof Request ? input.url : String(input);
    if (new URL(requestedUrl).hostname === 'health.example.test') {
      downstreamCalls += 1;
      return new Response('downstream failure body must not be returned', { status: 503 });
    }
    return originalFetch(input, init);
  };
  const identity: BusinessIdentity = { subject: 'health-check-user', scopes: new Set(['system:ulterpos:health:read']) };
  const app = createBusinessApp(async () => identity);
  const listener = app.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`));
  const client = new Client({ name: 'mcp1-circuit-test', version: '0.1.0' });

  try {
    await client.connect(transport as unknown as Transport);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await client.callTool({ name: 'business_system_health', arguments: { system: 'ulterpos' } });
      assert.equal(result.isError, undefined);
    }
    const open = await client.callTool({ name: 'business_system_health', arguments: { system: 'ulterpos' } });
    assert.equal(open.isError, true);
    assert.equal(downstreamCalls, 5);
  } finally {
    await client.close();
    listener.close();
    await once(listener, 'close');
    globalThis.fetch = originalFetch;
    restore.reverse().forEach((fn) => fn());
    previousAudit();
    await rm(temp, { recursive: true, force: true });
  }
});

test('global and per-user limits block calls independently of the per-IP limit', async () => {
  const restore = [
    setEnv('BUSINESS_ALLOWED_HOSTS', '127.0.0.1'),
    setEnv('BUSINESS_ALLOWED_ORIGINS', undefined),
    setEnv('BUSINESS_RATE_LIMIT_PER_MINUTE', '20'),
    setEnv('BUSINESS_USER_RATE_LIMIT_PER_MINUTE', '20'),
    setEnv('BUSINESS_GLOBAL_RATE_LIMIT_PER_MINUTE', '2'),
  ];
  try {
    const globalApp = createBusinessApp(async () => { throw new Error('not authenticated'); });
    const globalListener = globalApp.listen(0, '127.0.0.1');
    await once(globalListener, 'listening');
    const globalAddress = globalListener.address();
    assert.ok(globalAddress && typeof globalAddress !== 'string');
    const globalUrl = `http://127.0.0.1:${globalAddress.port}/mcp`;

    try {
      assert.equal((await fetch(globalUrl)).status, 401);
      assert.equal((await fetch(globalUrl)).status, 401);
      assert.equal((await fetch(globalUrl)).status, 429);
    } finally {
      globalListener.close();
      await once(globalListener, 'close');
    }

    process.env.BUSINESS_USER_RATE_LIMIT_PER_MINUTE = '1';
    process.env.BUSINESS_GLOBAL_RATE_LIMIT_PER_MINUTE = '20';
    const perUserApp = createBusinessApp(async () => ({ subject: 'single-user', scopes: new Set() }));
    const userListener = perUserApp.listen(0, '127.0.0.1');
    await once(userListener, 'listening');
    const userAddress = userListener.address();
    assert.ok(userAddress && typeof userAddress !== 'string');
    const userUrl = `http://127.0.0.1:${userAddress.port}/mcp`;

    try {
      const first = await fetch(userUrl, { headers: { authorization: 'Bearer test' } });
      assert.notEqual(first.status, 429);
      await first.body?.cancel();
      assert.equal((await fetch(userUrl, { headers: { authorization: 'Bearer test' } })).status, 429);
    } finally {
      userListener.close();
      await once(userListener, 'close');
    }
  } finally {
    restore.reverse().forEach((fn) => fn());
  }
});
