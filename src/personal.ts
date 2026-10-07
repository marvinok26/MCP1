import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerPersonalTools } from './personal-tools.js';
import { registerPersonalResources } from './personal-resources.js';

const server = new McpServer({ name: 'ulter-net-personal', version: '0.1.0' }, { maxToolInputElements: 100 });
registerPersonalTools(server);
registerPersonalResources(server);
await server.connect(new StdioServerTransport());
