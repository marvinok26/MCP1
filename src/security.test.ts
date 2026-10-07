import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'vitest';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { authenticateBearer, requireScope } from './security.js';

test('verifies OIDC signature, issuer, audience, expiry, and permission scopes', async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const key = { ...jwk, kid: 'mcp-test-key', use: 'sig', alg: 'RS256' };
  const server = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'public, max-age=300');
    res.end(JSON.stringify({ keys: [key] }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  const previous = {
    issuer: process.env.BUSINESS_ISSUER_URL,
    audience: process.env.BUSINESS_AUDIENCE,
    jwks: process.env.BUSINESS_JWKS_URL,
  };
  process.env.BUSINESS_ISSUER_URL = 'https://identity.example.test/';
  process.env.BUSINESS_AUDIENCE = 'https://mcp.example.test';
  process.env.BUSINESS_JWKS_URL = `http://127.0.0.1:${address.port}/jwks`;

  const sign = (overrides: { issuer?: string; audience?: string; expiresAt?: number } = {}, signer = privateKey) => {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({ scope: 'mcp:systems:list system:ulterpos:health:read' })
      .setProtectedHeader({ alg: 'RS256', kid: 'mcp-test-key' })
      .setSubject('staff-user-17')
      .setIssuer(overrides.issuer ?? 'https://identity.example.test/')
      .setAudience(overrides.audience ?? 'https://mcp.example.test')
      .setIssuedAt(now)
      .setExpirationTime(overrides.expiresAt ?? now + 60)
      .sign(signer);
  };

  try {
    const token = await sign();
    const identity = await authenticateBearer(`Bearer ${token}`);
    assert.equal(identity.subject, 'staff-user-17');
    assert.equal(identity.scopes.has('mcp:systems:list'), true);
    assert.doesNotThrow(() => requireScope(identity, 'system:ulterpos:health:read'));
    assert.throws(() => requireScope(identity, 'system:tranquil:health:read'), /Missing required permission/);

    await assert.rejects(authenticateBearer(undefined), /bearer access token/);
    await assert.rejects(authenticateBearer('Bearer malformed'), /token|compact|JWT/i);
    await assert.rejects(authenticateBearer(`Bearer ${await sign({ issuer: 'https://attacker.example.test/' })}`));
    await assert.rejects(authenticateBearer(`Bearer ${await sign({ audience: 'wrong-resource' })}`));
    await assert.rejects(authenticateBearer(`Bearer ${await sign({ expiresAt: Math.floor(Date.now() / 1000) - 1 })}`));
    const { privateKey: unrelatedKey } = await generateKeyPair('RS256');
    await assert.rejects(authenticateBearer(`Bearer ${await sign({}, unrelatedKey)}`));
  } finally {
    if (previous.issuer === undefined) delete process.env.BUSINESS_ISSUER_URL;
    else process.env.BUSINESS_ISSUER_URL = previous.issuer;
    if (previous.audience === undefined) delete process.env.BUSINESS_AUDIENCE;
    else process.env.BUSINESS_AUDIENCE = previous.audience;
    if (previous.jwks === undefined) delete process.env.BUSINESS_JWKS_URL;
    else process.env.BUSINESS_JWKS_URL = previous.jwks;
    server.close();
    await once(server, 'close');
  }
});
