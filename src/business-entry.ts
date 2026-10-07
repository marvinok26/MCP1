import { createBusinessApp } from './business.js';

const port = Number(process.env.PORT ?? process.env.BUSINESS_PORT ?? 8787);
const host = process.env.BUSINESS_HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('BUSINESS_PORT must be a valid TCP port');

createBusinessApp().listen(port, host, () => {
  process.stderr.write(`MCP1 business service listening on ${host}:${port}\n`);
});
