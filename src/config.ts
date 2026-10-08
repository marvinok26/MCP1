import 'dotenv/config';
import path from 'node:path';

export type ProjectConfig = { key: string; name: string; root: string };

const projectDefinitions = [
  ['ulterpos', 'UlterPOS', 'PROJECT_ULTERPOS_PATH', '/home/seint/Dev/Work/pos/ulterpos'],
  ['tranquil', 'Tranquil Pharmacy', 'PROJECT_TRANQUIL_PATH', '/home/seint/Dev/Work/tranquil'],
  ['ulternet', 'UlterNet website', 'PROJECT_ULTERNET_PATH', '/home/seint/Dev/Self/Apps/UlterNet-Systems/Company/UlterNet/website/devspark'],
  ['social-apps', 'Social apps', 'PROJECT_SOCIAL_APPS_PATH', '/home/seint/Dev/Self/Apps/UlterNet-Systems/Social/social-apps'],
  ['renegade', 'Renegade Tickets & Events', 'PROJECT_RENEGADE_PATH', '/home/seint/Dev/Self/Apps/UlterNet-Systems/Tickets&Events/renegade/website/renegade'],
] as const;

export const projects: ProjectConfig[] = projectDefinitions.map(([key, name, variable, defaultRoot]) => ({
  key,
  name,
  root: path.resolve(process.env[variable] || defaultRoot),
}));

export function allProjects(): ProjectConfig[] {
  return projects;
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Required environment variable ${name} is not set`);
  return value;
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}
