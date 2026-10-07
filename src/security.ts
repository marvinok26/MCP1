import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import { requiredEnv } from './config.js';

export type BusinessIdentity = { subject: string; scopes: Set<string> };

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

function keySet() {
  if (!jwks) jwks = createRemoteJWKSet(new URL(requiredEnv('BUSINESS_JWKS_URL')));
  return jwks;
}

export async function authenticateBearer(header: string | undefined): Promise<BusinessIdentity> {
  const match = header?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('A bearer access token is required');

  const { payload } = await jwtVerify(match[1]!, keySet(), {
    issuer: requiredEnv('BUSINESS_ISSUER_URL'),
    audience: requiredEnv('BUSINESS_AUDIENCE'),
    algorithms: ['RS256', 'ES256'],
  });
  const subject = payload.sub;
  if (!subject) throw new Error('The access token has no subject');
  return { subject, scopes: tokenScopes(payload) };
}

function tokenScopes(payload: JWTPayload): Set<string> {
  const rawScope = payload.scope;
  const rawScp = payload.scp;
  const values = [
    ...(typeof rawScope === 'string' ? rawScope.split(/\s+/) : []),
    ...(Array.isArray(rawScp) ? rawScp.filter((value): value is string => typeof value === 'string') : []),
  ];
  return new Set(values.filter(Boolean));
}

export function requireScope(identity: BusinessIdentity, scope: string): void {
  if (!identity.scopes.has(scope)) throw new Error(`Missing required permission: ${scope}`);
}
