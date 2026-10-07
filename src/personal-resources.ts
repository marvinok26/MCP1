import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { allProjects, getProject, resolveProjectFile } from './projects.js';

const maxResources = 200;
const maxResourcesPerProject = 40;
const maxDepth = 4;
const maxFileBytes = 128_000;
const documentationExtensions = new Set(['.md', '.mdx', '.rst', '.txt']);

function isDocumentationPath(file: string): boolean {
  const segments = file.split('/');
  if (file.includes('\\') || path.posix.normalize(file) !== file || segments.some((segment) => !segment || segment === '.' || segment === '..' || segment.startsWith('.'))) return false;
  return file === 'README.md' || (segments[0] === 'docs' && documentationExtensions.has(path.posix.extname(file).toLowerCase()));
}

function resourceUri(project: string, file: string): string {
  const safeFile = file.split('/').map(encodeURIComponent).join('/');
  return `mcp1-doc://${encodeURIComponent(project)}/${safeFile}`;
}

function mimeType(file: string): string {
  return path.posix.extname(file).toLowerCase() === '.md' || path.posix.extname(file).toLowerCase() === '.mdx'
    ? 'text/markdown'
    : 'text/plain';
}

async function collectProjectDocs(project: ReturnType<typeof getProject>): Promise<string[]> {
  const files: string[] = [];
  try {
    const readme = await resolveProjectFile(project, 'README.md');
    if ((await stat(readme)).isFile()) files.push('README.md');
  } catch {
    // A missing or excluded root README is normal; omit it from the catalogue.
  }

  let docsRoot: string;
  try {
    docsRoot = await resolveProjectFile(project, 'docs');
    if (!(await stat(docsRoot)).isDirectory()) return files;
  } catch {
    return files;
  }

  async function walk(directory: string, relativeDirectory: string, depth: number): Promise<void> {
    if (depth > maxDepth || files.length >= maxResourcesPerProject) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      if (files.length >= maxResourcesPerProject || entry.name.startsWith('.')) continue;
      const relative = `${relativeDirectory}/${entry.name}`;
      if (entry.isDirectory()) {
        await walk(path.join(directory, entry.name), relative, depth + 1);
      } else if (entry.isFile() && documentationExtensions.has(path.posix.extname(entry.name).toLowerCase())) {
        try {
          const safePath = await resolveProjectFile(project, relative);
          if ((await stat(safePath)).size <= maxFileBytes) files.push(relative);
        } catch {
          // Skip paths that are unavailable, excluded, or exceed the file-size bound.
        }
      }
    }
  }

  await walk(docsRoot, 'docs', 0);
  return files;
}

export function registerPersonalResources(server: McpServer): void {
  const template = new ResourceTemplate('mcp1-doc://{project}/{+file}', {
    list: async () => {
      const resources: { uri: string; name: string; description: string; mimeType: string }[] = [];
      for (const project of allProjects()) {
        for (const file of await collectProjectDocs(project)) {
          resources.push({
            uri: resourceUri(project.key, file),
            name: `${project.name}: ${file}`,
            description: 'Project documentation file. Content is read on demand and must remain within the configured project root.',
            mimeType: mimeType(file),
          });
          if (resources.length >= maxResources) return { resources };
        }
      }
      return { resources };
    },
  });

  server.registerResource('project-documentation', template, {
    description: 'Read root README files and bounded Markdown, MDX, reStructuredText, and text files from each configured project docs directory.',
    mimeType: 'text/markdown',
  }, async (uri, variables) => {
    const projectKey = variables.project;
    const encodedFile = variables.file;
    if (typeof projectKey !== 'string' || typeof encodedFile !== 'string') {
      throw new Error('The requested documentation resource is not available');
    }
    let file: string;
    try {
      file = decodeURIComponent(encodedFile);
    } catch {
      throw new Error('The requested documentation resource is not available');
    }
    if (!isDocumentationPath(file)) throw new Error('The requested documentation resource is not available');
    const project = getProject(projectKey);
    const absolute = await resolveProjectFile(project, file);
    const metadata = await stat(absolute);
    if (!metadata.isFile() || metadata.size > maxFileBytes) throw new Error('Only documentation files up to 128 KB can be read');
    const text = await readFile(absolute, 'utf8');
    return { contents: [{ uri: uri.href, mimeType: mimeType(file), text }] };
  });
}
