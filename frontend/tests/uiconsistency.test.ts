import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tabsDir = path.resolve(__dirname, '../src/components/tabs');
const files = fs.readdirSync(tabsDir).filter((f) => f.endsWith('.tsx'));

console.log(`--- UI CONSISTENCY & CLEAN DESIGN AUDIT (${files.length} TABS) ---`);
let issues = 0;

for (const file of files) {
  const content = fs.readFileSync(path.join(tabsDir, file), 'utf8');

  // Check 1: No duplicate breadcrumbs
  if (content.includes('items-center gap-2 text-xs font-medium text-slate-400')) {
    console.error(`FAIL: ${file} contains duplicate breadcrumb container!`);
    issues++;
  }

  // Check 2: No clunky boxed icon headers
  if (content.includes('bg-kali-primary/10 border border-kali-primary/20 text-kali-primary')) {
    console.error(`FAIL: ${file} contains clunky boxed icon header!`);
    issues++;
  }

  // Check 3: No pseudo-terminal loud ASCII prefixes in visible JSX
  if (/(\/\/\s*SECTION_[A-Z]|\/\/\s*SOC_COMMAND|\[CONSOLE_INSPECT\])/i.test(content)) {
    console.error(`FAIL: ${file} contains loud pseudo-terminal ASCII headers!`);
    issues++;
  }

  // Check 4: Must use space-y-8 at root
  if (!content.includes('className="space-y-8"')) {
    console.error(`FAIL: ${file} does not use standard space-y-8 root spacing!`);
    issues++;
  }
}

if (issues === 0) {
  console.log(`PASS: All ${files.length} tabs passed UI consistency checks with ZERO issues!`);
} else {
  console.error(`FAIL: Found ${issues} UI consistency issues across tabs.`);
  process.exit(1);
}
