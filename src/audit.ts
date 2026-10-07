import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { optionalEnv } from './config.js';

export type AuditEvent = {
  event: 'tool_call';
  mode: 'business';
  actor: string;
  tool: string;
  outcome: 'success' | 'denied' | 'error';
  at: string;
  requestId: string;
};

export async function audit(event: Omit<AuditEvent, 'event' | 'mode' | 'at'>): Promise<void> {
  const file = path.resolve(optionalEnv('AUDIT_LOG_PATH') ?? './var/audit.jsonl');
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const record: AuditEvent = { event: 'tool_call', mode: 'business', at: new Date().toISOString(), ...event };
  await appendFile(file, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
}
