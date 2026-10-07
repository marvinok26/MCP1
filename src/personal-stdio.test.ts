import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('personal stdio server serves safe files and documentation resources from configured roots', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'mcp1-stdio-'));
  const projectKeys = ['ulterpos', 'tranquil', 'devspark', 'social-apps', 'renegade'] as const;
  const projectRoots = Object.fromEntries(projectKeys.map((key) => [key, path.join(fixtureRoot, key)])) as Record<(typeof projectKeys)[number], string>;
  for (const key of projectKeys) {
    await mkdir(path.join(projectRoots[key], 'docs'), { recursive: true });
    await writeFile(path.join(projectRoots[key], 'README.md'), `# ${key}\n`);
    await writeFile(path.join(projectRoots[key], 'docs', 'guide.md'), `Guide for ${key}.\n`);
    await writeFile(path.join(projectRoots[key], '.env'), 'TOKEN=fixture-secret\n');
    await writeFile(path.join(projectRoots[key], 'docs', '.hidden.md'), 'Hidden fixture.\n');
  }
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: os.tmpdir(),
    NODE_ENV: 'test',
    PROJECT_ULTERPOS_PATH: projectRoots.ulterpos,
    PROJECT_TRANQUIL_PATH: projectRoots.tranquil,
    PROJECT_DEVSPARK_PATH: projectRoots.devspark,
    PROJECT_SOCIAL_APPS_PATH: projectRoots['social-apps'],
    PROJECT_RENEGADE_PATH: projectRoots.renegade,
  };
  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.resolve('dist/personal.js')],
    cwd: process.cwd(),
    env,
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

    const resources = await client.listResources();
    const uris = resources.resources.map(({ uri }) => uri);
    assert.ok(uris.includes('mcp1-doc://ulterpos/README.md'));
    assert.ok(uris.includes('mcp1-doc://ulterpos/docs/guide.md'));
    assert.ok(!uris.some((uri) => uri.includes('.env') || uri.includes('.hidden')));

    const document = await client.readResource({ uri: 'mcp1-doc://ulterpos/docs/guide.md' });
    const documentContent = document.contents[0];
    assert.ok(documentContent && 'text' in documentContent);
    assert.match(documentContent.text, /Guide for ulterpos/);
    await assert.rejects(client.readResource({ uri: 'mcp1-doc://ulterpos/.env' }));
  } finally {
    await client.close();
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
