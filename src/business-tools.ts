import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { allProjects, optionalEnv } from './config.js';
import { audit } from './audit.js';
import { requireScope, type BusinessIdentity } from './security.js';

const projects = allProjects();
const projectKey = z.enum(['ulterpos', 'tranquil', 'devspark', 'social-apps', 'renegade']);
const textResult = (text: string) => ({ content: [{ type: 'text' as const, text }] });
const maxConcurrentHealthChecks = Number(process.env.BUSINESS_MAX_CONCURRENT_HEALTH_CHECKS ?? 20);
const healthCircuits = new Map<string, { failures: number; openUntil: number; probeInFlight: boolean }>();
let activeHealthChecks = 0;

if (!Number.isInteger(maxConcurrentHealthChecks) || maxConcurrentHealthChecks < 1 || maxConcurrentHealthChecks > 100) {
  throw new Error('BUSINESS_MAX_CONCURRENT_HEALTH_CHECKS must be an integer from 1 to 100');
}

function circuitFor(system: string) {
  let circuit = healthCircuits.get(system);
  if (!circuit) {
    circuit = { failures: 0, openUntil: 0, probeInFlight: false };
    healthCircuits.set(system, circuit);
  }
  return circuit;
}

function acquireHealthCircuit(system: string): boolean {
  const circuit = circuitFor(system);
  const now = Date.now();
  if (circuit.openUntil > now) return false;
  if (circuit.openUntil > 0) {
    if (circuit.probeInFlight) return false;
    circuit.probeInFlight = true;
  }
  return true;
}

function recordHealthSuccess(system: string): void {
  const circuit = circuitFor(system);
  circuit.failures = 0;
  circuit.openUntil = 0;
  circuit.probeInFlight = false;
}

function recordHealthFailure(system: string): void {
  const circuit = circuitFor(system);
  circuit.probeInFlight = false;
  circuit.failures += 1;
  if (circuit.failures >= 5) circuit.openUntil = Date.now() + 30_000;
}

function integrationFor(key: string) {
  const normalized = key.toUpperCase().replaceAll('-', '_');
  const endpoint = optionalEnv(`SYSTEM_${normalized}_HEALTH_URL`);
  const token = optionalEnv(`SYSTEM_${normalized}_HEALTH_TOKEN`);
  return endpoint ? { endpoint, token } : undefined;
}

function assertSafeHealthUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('Configured health endpoints must use HTTPS and cannot include credentials or fragments');
  }
  return url;
}

async function audited<T>(identity: BusinessIdentity, requestId: string, tool: string, operation: () => Promise<T>): Promise<T> {
  try {
    const value = await operation();
    await audit({ actor: identity.subject, requestId, tool, outcome: 'success' });
    return value;
  } catch (error) {
    const outcome = error instanceof Error && error.message.startsWith('Missing required permission:') ? 'denied' : 'error';
    await audit({ actor: identity.subject, requestId, tool, outcome });
    throw error;
  }
}

export function registerBusinessTools(server: McpServer, identity: BusinessIdentity, requestId: string): void {
  server.registerTool('business_systems_list', {
    title: 'List available business systems',
    description: 'List configured systems the authenticated user has permission to inspect.',
  }, async () => audited(identity, requestId, 'business_systems_list', async () => {
    requireScope(identity, 'mcp:systems:list');
    const available = projects
      .filter((project) => identity.scopes.has(`system:${project.key}:health:read`) && integrationFor(project.key))
      .map(({ key, name }) => ({ key, name }));
    return textResult(JSON.stringify(available, null, 2));
  }));

  server.registerTool('business_system_health', {
    title: 'Check business system health',
    description: 'Call the configured HTTPS health endpoint for a permitted system and return only its HTTP reachability status.',
    inputSchema: { system: projectKey },
  }, async ({ system }) => audited(identity, requestId, 'business_system_health', async () => {
    requireScope(identity, `system:${system}:health:read`);
    const integration = integrationFor(system);
    if (!integration) throw new Error(`No health endpoint is configured for ${system}`);
    const url = assertSafeHealthUrl(integration.endpoint);
    if (!acquireHealthCircuit(system)) throw new Error('Health check temporarily unavailable; the downstream circuit is open.');
    if (activeHealthChecks >= maxConcurrentHealthChecks) {
      const circuit = circuitFor(system);
      if (circuit.openUntil > 0) circuit.probeInFlight = false;
      throw new Error('Health check capacity is busy; retry shortly.');
    }
    activeHealthChecks += 1;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: integration.token ? { authorization: `Bearer ${integration.token}`, accept: 'application/json' } : { accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(4_000),
      });
      if (response.status >= 500 || response.status === 429) recordHealthFailure(system);
      else recordHealthSuccess(system);
      return textResult(JSON.stringify({ system, reachable: response.ok, httpStatus: response.status }));
    } catch (error) {
      recordHealthFailure(system);
      throw error;
    } finally {
      activeHealthChecks -= 1;
    }
  }));
}
