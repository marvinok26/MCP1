import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'vitest';
import { type ProjectConfig } from './config.js';
import { resolveProjectFile } from './projects.js';

test('project file access stays inside its root and rejects common credential paths', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'mcp1-path-'));
  const root = path.join(temp, 'project');
  await mkdir(root);
  await writeFile(path.join(root, 'README.md'), 'safe documentation');
  await writeFile(path.join(root, '.env'), 'secret=value');
  await writeFile(path.join(root, 'settings.env'), 'secret=value');
  await writeFile(path.join(temp, 'outside.txt'), 'outside');
  await symlink(path.join(temp, 'outside.txt'), path.join(root, 'outside-link.txt'));
  const project: ProjectConfig = { key: 'example', name: 'Example', root };

  try {
    assert.equal(await resolveProjectFile(project, 'README.md'), path.join(root, 'README.md'));
    await assert.rejects(resolveProjectFile(project, '../outside.txt'), /not available/);
    await assert.rejects(resolveProjectFile(project, '.env'), /not available/);
    await assert.rejects(resolveProjectFile(project, 'settings.env'), /not available/);
    await assert.rejects(resolveProjectFile(project, 'outside-link.txt'), /not available/);
    await assert.rejects(resolveProjectFile(project, path.join(temp, 'outside.txt')), /not available/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
