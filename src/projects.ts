import { realpath } from 'node:fs/promises';
import path from 'node:path';
import { projects, type ProjectConfig } from './config.js';

export const excludedParts = new Set(['.git', 'node_modules', 'vendor', 'storage', 'dist', 'build', 'coverage']);
const excludedNames = new Set(['.env', '.npmrc', 'auth.json', 'credentials', 'id_rsa', 'id_ed25519']);

export function getProject(key: string): ProjectConfig {
  const project = projects.find((item) => item.key === key);
  if (!project) throw new Error(`Unknown project key: ${key}`);
  return project;
}

export function allProjects(): ProjectConfig[] {
  return projects;
}

export function isExcluded(relativePath: string): boolean {
  const parts = relativePath.split(/[\\/]/);
  return parts.some((part) => excludedParts.has(part)
    || excludedNames.has(part)
    || part.startsWith('.env.')
    || part.endsWith('.env')
    || part.endsWith('.pem')
    || part.endsWith('.key')
    || part.endsWith('.p12')
    || part.endsWith('.pfx'));
}

export async function resolveProjectFile(project: ProjectConfig, relativePath: string): Promise<string> {
  if (!relativePath || path.isAbsolute(relativePath) || isExcluded(relativePath)) {
    throw new Error('The requested path is not available');
  }
  const root = await realpath(project.root);
  const absolute = await realpath(path.resolve(root, relativePath));
  if (!absolute.startsWith(`${root}${path.sep}`) || isExcluded(path.relative(root, absolute))) {
    throw new Error('The requested path is not available');
  }
  return absolute;
}
