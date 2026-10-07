import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { allProjects, getProject, resolveProjectFile } from './projects.js';

const execFileAsync = promisify(execFile);
const textResult = (text: string) => ({ content: [{ type: 'text' as const, text }] });

export function registerPersonalTools(server: McpServer): void {
  server.registerTool('project_list', {
    title: 'List configured projects',
    description: 'List the configured project names and local paths available to personal development tools.',
  }, async () => textResult(JSON.stringify(allProjects().map(({ key, name, root }) => ({ key, name, root })), null, 2)));

  server.registerTool('project_read_file', {
    title: 'Read a project file',
    description: 'Read a text file inside a configured project. Secret, dependency, and generated paths are blocked.',
    inputSchema: { project: z.string(), file: z.string().max(500) },
  }, async ({ project: projectKey, file }) => {
    const project = getProject(projectKey);
    const absolute = await resolveProjectFile(project, file);
    const metadata = await stat(absolute);
    if (!metadata.isFile() || metadata.size > 128_000) throw new Error('Only files up to 128 KB can be read');
    const contents = await readFile(absolute, 'utf8');
    return textResult(contents);
  });

  server.registerTool('project_search', {
    title: 'Search project text',
    description: 'Search tracked project source and documentation using ripgrep, excluding secrets, dependencies, and build output.',
    inputSchema: {
      project: z.string(),
      query: z.string().min(1).max(200),
      limit: z.number().int().min(1).max(100).default(40),
    },
  }, async ({ project: projectKey, query, limit }) => {
    const project = getProject(projectKey);
    const args = [
      '--line-number', '--column', '--fixed-strings', '--max-count', '8',
      '--glob', '!**/.env*', '--glob', '!**/.npmrc', '--glob', '!**/auth.json',
      '--glob', '!**/credentials', '--glob', '!**/*.pem', '--glob', '!**/*.key',
      '--glob', '!**/*.p12', '--glob', '!**/*.pfx',
    ];
    for (const part of ['.git', 'node_modules', 'vendor', 'storage', 'dist', 'build', 'coverage']) args.push('--glob', `!**/${part}/**`);
    args.push('--', query, project.root);
    try {
      const { stdout } = await execFileAsync('rg', args, { maxBuffer: 1_000_000, timeout: 5_000 });
      const lines = stdout.split('\n').filter(Boolean).slice(0, limit);
      return textResult(lines.join('\n') || 'No matches.');
    } catch (error) {
      const result = error as { code?: number; stdout?: string; message?: string };
      if (result.code === 1) return textResult('No matches.');
      if (typeof result.stdout === 'string') return textResult(result.stdout.split('\n').filter(Boolean).slice(0, limit).join('\n'));
      throw new Error('Project search failed. Confirm ripgrep is installed and the project is readable.');
    }
  });

  server.registerTool('git_status', {
    title: 'Review project Git status',
    description: 'Show the current branch and changed-file status for a configured project.',
    inputSchema: { project: z.string() },
  }, async ({ project: projectKey }) => {
    const project = getProject(projectKey);
    const { stdout } = await execFileAsync('git', ['-C', project.root, 'status', '--short', '--branch'], { maxBuffer: 100_000, timeout: 5_000 });
    return textResult(stdout || 'Working tree clean.');
  });

  server.registerTool('git_diff', {
    title: 'Review project Git diff',
    description: 'Show a bounded diff of working-tree changes. This tool cannot stage, commit, reset, or push.',
    inputSchema: { project: z.string(), staged: z.boolean().default(false) },
  }, async ({ project: projectKey, staged }) => {
    const project = getProject(projectKey);
    const args = ['-C', project.root, 'diff', '--no-ext-diff', '--no-color', '--'];
    if (staged) args.splice(3, 0, '--cached');
    const { stdout } = await execFileAsync('git', args, { maxBuffer: 500_000, timeout: 5_000 });
    return textResult(stdout.slice(0, 100_000) || 'No diff.');
  });
}
