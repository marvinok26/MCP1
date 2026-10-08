import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { allProjects, getProject, resolveProjectFile } from './projects.js';
import { analyticsChannelSummary, analyticsLandingPageSummary, searchPerformanceSummary, type ReportingSystem } from './google-reporting.js';

const execFileAsync = promisify(execFile);
const textResult = (text: string) => ({ content: [{ type: 'text' as const, text }] });

async function runGit(projectRoot: string, args: string[], operation: 'status' | 'diff'): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', projectRoot, ...args], { maxBuffer: operation === 'status' ? 100_000 : 500_000, timeout: 5_000 });
    return stdout;
  } catch (error) {
    const details = error as { code?: string | number; stderr?: string; path?: string };
    if (details.code === 'ENOENT' && details.path === 'git') throw new Error('Git is not installed on this machine.');
    if (details.code === 128 && /cannot change to|not a git repository/i.test(details.stderr ?? '')) {
      throw new Error('This configured project path is unavailable or is not a Git repository.');
    }
    throw new Error(`Git ${operation} is unavailable. Check that the project is readable and Git is installed.`);
  }
}

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
    let absolute: string;
    try {
      absolute = await resolveProjectFile(project, file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('The configured project path or requested file is unavailable. Check the project path configuration.');
      throw error;
    }
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
      const result = error as { code?: string | number; stdout?: string; path?: string };
      if (result.code === 1) return textResult('No matches.');
      if (result.code === 'ENOENT' && result.path === 'rg') throw new Error('Ripgrep is not installed. Install `rg` and retry the search.');
      if (result.code === 'ENOENT') throw new Error('The configured project path is unavailable. Check the project path configuration.');
      if (typeof result.stdout === 'string') return textResult(result.stdout.split('\n').filter(Boolean).slice(0, limit).join('\n'));
      throw new Error('Project search could not complete. Check that the configured project path is readable and `rg` is installed.');
    }
  });

  server.registerTool('git_status', {
    title: 'Review project Git status',
    description: 'Show the current branch and changed-file status for a configured project.',
    inputSchema: { project: z.string() },
  }, async ({ project: projectKey }) => {
    const project = getProject(projectKey);
    const stdout = await runGit(project.root, ['status', '--short', '--branch'], 'status');
    return textResult(stdout || 'Working tree clean.');
  });

  server.registerTool('git_diff', {
    title: 'Review project Git diff',
    description: 'Show a bounded diff of working-tree changes. This tool cannot stage, commit, reset, or push.',
    inputSchema: { project: z.string(), staged: z.boolean().default(false) },
  }, async ({ project: projectKey, staged }) => {
    const project = getProject(projectKey);
    const args = ['diff', '--no-ext-diff', '--no-color', '--'];
    if (staged) args.splice(1, 0, '--cached');
    const stdout = await runGit(project.root, args, 'diff');
    return textResult(stdout.slice(0, 100_000) || 'No diff.');
  });

  const marketingSystem = z.enum(['ulterpos', 'tranquil', 'ulternet', 'social-apps', 'renegade']);
  const reportDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD dates');
  server.registerTool('marketing_channel_summary', {
    title: 'Summarize website traffic by channel',
    description: 'Return aggregate GA4 sessions, active users, and key events by channel for a configured UlterNet property. Date ranges are limited to 90 days; no visitor identifiers are returned.',
    inputSchema: { system: marketingSystem, start_date: reportDate, end_date: reportDate },
  }, async ({ system, start_date, end_date }) => textResult(JSON.stringify(await analyticsChannelSummary(system as ReportingSystem, start_date, end_date), null, 2)));

  server.registerTool('marketing_landing_pages', {
    title: 'Summarize website landing pages',
    description: 'Return aggregate GA4 sessions, active users, and key events for the top 25 landing-page paths. Query strings are omitted and date ranges are limited to 90 days.',
    inputSchema: { system: marketingSystem, start_date: reportDate, end_date: reportDate },
  }, async ({ system, start_date, end_date }) => textResult(JSON.stringify(await analyticsLandingPageSummary(system as ReportingSystem, start_date, end_date), null, 2)));

  server.registerTool('marketing_search_performance', {
    title: 'Summarize organic search performance',
    description: 'Return aggregate Search Console clicks, impressions, click-through rate, average position, and top page paths for a configured property. Search terms and visitor identifiers are excluded; date ranges are limited to 90 days.',
    inputSchema: { system: marketingSystem, start_date: reportDate, end_date: reportDate },
  }, async ({ system, start_date, end_date }) => textResult(JSON.stringify(await searchPerformanceSummary(system as ReportingSystem, start_date, end_date), null, 2)));
}
