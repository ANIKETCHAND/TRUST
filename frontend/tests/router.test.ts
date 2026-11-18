import { ROUTE_TAB_MAP, TAB_ROUTE_MAP, normalizePath, isKnownRoute } from '../src/context/routes.ts';

const requiredRoutes = [
  '/threat-radar',
  '/active-defense',
  '/agents',
  '/gateway-monitor',
  '/tools',
  '/policies',
  '/delegation',
  '/provenance',
  '/playground',
  '/incidents',
  '/forensics',
  '/audit',
  '/browser-shield',
  '/endpoints',
  '/integrations',
  '/dashboard',
];

console.log('--- ROUTING VERIFICATION TEST ---');
console.log('Total routes registered:', Object.keys(ROUTE_TAB_MAP).length);
console.log('Total tabs registered:', Object.keys(TAB_ROUTE_MAP).length);

let errors = 0;

for (const route of requiredRoutes) {
  const tab = ROUTE_TAB_MAP[route];
  if (!tab) {
    console.error(`FAIL: Missing required route ${route}`);
    errors++;
  } else {
    console.log(`PASS: ${route} -> tab: '${tab}'`);
  }
}

for (const [tab, route] of Object.entries(TAB_ROUTE_MAP)) {
  const backTab = ROUTE_TAB_MAP[route];
  if (backTab !== tab) {
    console.error(`FAIL: Asymmetric mapping: tab ${tab} -> route ${route} -> tab ${backTab}`);
    errors++;
  }
}

// Test path normalization
const normalizations: [string, string][] = [
  ['/', '/'],
  ['', '/'],
  ['/dashboard/', '/dashboard'],
  ['/agents?filter=active', '/agents'],
  ['/tools#section', '/tools'],
  ['/login/', '/login'],
  ['/#features', '/'],
  ['/threat-radar?refresh=true#matrix', '/threat-radar'],
];

for (const [input, expected] of normalizations) {
  const actual = normalizePath(input);
  if (actual !== expected) {
    console.error(`FAIL: normalizePath('${input}') = '${actual}', expected '${expected}'`);
    errors++;
  } else {
    console.log(`PASS: normalizePath('${input}') -> '${actual}'`);
  }
}

// Test route classification & 404 detection
const validRoutes = [
  '/',
  '/login',
  '/dashboard',
  '/threat-radar',
  '/active-defense',
  '/agents',
  '/gateway-monitor',
  '/tools',
  '/policies',
  '/delegation',
  '/provenance',
  '/playground',
  '/incidents',
  '/forensics',
  '/audit',
  '/browser-shield',
  '/endpoints',
  '/integrations',
  '/settings',
  '/docs',
  '/redoc',
];

for (const r of validRoutes) {
  if (!isKnownRoute(r)) {
    console.error(`FAIL: isKnownRoute('${r}') returned false, expected true`);
    errors++;
  } else {
    console.log(`PASS: isKnownRoute('${r}') -> true`);
  }
}

const invalidRoutes = [
  '/unknown-route',
  '/admin/fake',
  '/non-existent',
  '/exploit-test',
  '/dashboard-invalid',
];

for (const r of invalidRoutes) {
  if (isKnownRoute(r)) {
    console.error(`FAIL: isKnownRoute('${r}') returned true, expected false`);
    errors++;
  } else {
    console.log(`PASS: isKnownRoute('${r}') -> false (properly detected as 404)`);
  }
}

if (errors === 0) {
  console.log('ALL ROUTING CONSISTENCY CHECKS PASSED SUCCESSFULLY!');
} else {
  console.error(`Routing checks failed with ${errors} error(s)`);
  process.exit(1);
}
