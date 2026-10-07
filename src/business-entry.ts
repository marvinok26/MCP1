import { createBusinessApp } from './business.js';

const port = Number(process.env.PORT ?? process.env.BUSINESS_PORT ?? 8787);
const host = process.env.BUSINESS_HOST ?? '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error('BUSINESS_PORT must be a valid TCP port');

const app = createBusinessApp();
app.locals.mcpReady = false;
const server = app.listen(port, host, () => {
  app.locals.mcpReady = true;
  process.stderr.write(`MCP1 business service listening on ${host}:${port}\n`);
});

let shuttingDown = false;
function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;
  app.locals.mcpReady = false;
  process.stderr.write(`MCP1 business service received ${signal}; draining requests\n`);
  const forceClose = setTimeout(() => {
    process.stderr.write('MCP1 business service drain deadline reached; closing remaining connections\n');
    server.closeAllConnections();
  }, 10_000);
  forceClose.unref();
  server.close((error) => {
    clearTimeout(forceClose);
    if (error) process.stderr.write('MCP1 business service shutdown did not complete cleanly\n');
    process.exitCode = error ? 1 : 0;
  });
}

process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
