import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('personal stdio server serves safe files from all five configured project roots', async () => {
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.resolve('dist/personal.js')],
    cwd: process.cwd(),
  });
  const client = new Client({ name: 'mcp1-personal-stdio-check', version: '0.1.0' });

  try {
    await client.connect(transport);
    const projectsResult = await client.callTool({ name: 'project_list', arguments: {} });
    const projectPayload = projectsResult.content as Array<{ text?: string }>;
    const projects = JSON.parse(projectPayload[0]?.text ?? '[]') as Array<{ key: string }>;
    const expected = ['ulterpos', 'tranquil', 'devspark', 'social-apps', 'renegade'];
    assert.deepEqual(projects.map(({ key }) => key).sort(), expected.sort());

    for (const project of expected) {
      const result = await client.callTool({ name: 'project_read_file', arguments: { project, file: 'README.md' } });
      assert.notEqual(result.isError, true, `${project} README should be readable`);
      const content = result.content as Array<{ text?: string }>;
      assert.ok(content[0]?.text?.trim(), `${project} README should return text`);
    }

    const blocked = await client.callTool({ name: 'project_read_file', arguments: { project: 'ulterpos', file: '.env' } });
    assert.equal(blocked.isError, true);
  } finally {
    await client.close();
  }
});
