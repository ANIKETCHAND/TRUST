import type { PlatformTab } from './SecurityPlatformContext';

export const ROUTE_TAB_MAP: Record<string, PlatformTab> = {
  '/dashboard': 'overview',
  '/overview': 'overview',
  '/threat-radar': 'threat-map',
  '/threat-map': 'threat-map',
  '/active-defense': 'active-defense',
  '/agents': 'agents',
  '/gateway-monitor': 'monitor',
  '/monitor': 'monitor',
  '/tools': 'tools',
  '/policies': 'policies',
  '/delegation': 'delegations',
  '/delegations': 'delegations',
  '/provenance': 'provenance',
  '/playground': 'agent-runner',
  '/agent-runner': 'agent-runner',
  '/incidents': 'incidents',
  '/forensics': 'reports',
  '/reports': 'reports',
  '/audit': 'audit',
  '/browser-shield': 'browser-shield',
  '/endpoints': 'endpoints',
  '/integrations': 'integrations',
  '/settings': 'settings',
};

export const TAB_ROUTE_MAP: Record<PlatformTab, string> = {
  overview: '/dashboard',
  'threat-map': '/threat-radar',
  'active-defense': '/active-defense',
  agents: '/agents',
  monitor: '/gateway-monitor',
  tools: '/tools',
  policies: '/policies',
  delegations: '/delegation',
  provenance: '/provenance',
  'agent-runner': '/playground',
  incidents: '/incidents',
  reports: '/forensics',
  audit: '/audit',
  'browser-shield': '/browser-shield',
  endpoints: '/endpoints',
  integrations: '/integrations',
  settings: '/settings',
};

export function normalizePath(rawPath: string): string {
  const clean = rawPath.split('?')[0].split('#')[0];
  if (!clean || clean === '') return '/';
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1);
  }
  return clean;
}

export const KNOWN_STATIC_ROUTES = new Set<string>([
  '/',
  '/login',
  '/docs',
  '/redoc',
  ...Object.keys(ROUTE_TAB_MAP),
]);

export function isKnownRoute(rawPath: string): boolean {
  const norm = normalizePath(rawPath);
  return KNOWN_STATIC_ROUTES.has(norm);
}
