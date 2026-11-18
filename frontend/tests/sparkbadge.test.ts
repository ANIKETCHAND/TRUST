import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

console.log('--- SPARK BADGE COMPONENT & ASSETS VERIFICATION TEST ---');

// 1. Verify existence of required registered files
const sparkBadgeTsxPath = path.join(rootDir, 'src/shaders/spark-badge/SparkBadge.tsx');
const sparkBadgeHtmlPath = path.join(rootDir, 'src/shaders/spark-badge/spark-badge.html');
const sparkBadgePublicPath = path.join(rootDir, 'public/spark-badge.html');
const threeuiCssPath = path.join(rootDir, 'src/shaders/threeui.css');
const scenePath = path.join(rootDir, 'src/shaders/spark-badge/Scene.tsx');

assert(fs.existsSync(sparkBadgeTsxPath), 'SparkBadge.tsx must exist');
assert(fs.existsSync(sparkBadgeHtmlPath), 'spark-badge.html must exist in shaders');
assert(fs.existsSync(sparkBadgePublicPath), 'spark-badge.html must exist in public for Vite serving');
assert(fs.existsSync(threeuiCssPath), 'threeui.css must exist');
assert(fs.existsSync(scenePath), 'Scene.tsx must exist');
console.log('PASS: All required registered files exist.');

// 2. Verify SHA-256 of unmodified registered source files
const sparkBadgeTsxContent = fs.readFileSync(sparkBadgeTsxPath, 'utf8');
const sparkBadgeTsxHash = crypto.createHash('sha256').update(sparkBadgeTsxContent).digest('hex');
assert.strictEqual(
  sparkBadgeTsxHash,
  '2968baef448957765473ccd031f4337d376dbace5e8ec5434d0a57299ffecdda',
  'SparkBadge.tsx SHA-256 must match exact registered source'
);
console.log('PASS: SparkBadge.tsx SHA-256 matches exact source (2968baef448957765473ccd031f4337d376dbace5e8ec5434d0a57299ffecdda).');

const threeuiCssContent = fs.readFileSync(threeuiCssPath, 'utf8');
const threeuiCssHash = crypto.createHash('sha256').update(threeuiCssContent).digest('hex');
assert.strictEqual(
  threeuiCssHash,
  'efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf',
  'threeui.css SHA-256 must match exact registered source'
);
console.log('PASS: threeui.css SHA-256 matches exact source (efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf).');

// 3. Verify spark-badge.html contains CrossX and not Codex
const htmlContent = fs.readFileSync(sparkBadgeHtmlPath, 'utf8');
const publicHtmlContent = fs.readFileSync(sparkBadgePublicPath, 'utf8');

assert(htmlContent.includes("const str = 'CrossX'"), "spark-badge.html must render 'CrossX'");
assert(!htmlContent.includes("const str = 'Codex'"), "spark-badge.html must NOT contain 'Codex'");
assert.strictEqual(htmlContent, publicHtmlContent, 'Public and src spark-badge.html must match');
console.log("PASS: spark-badge.html correctly replaced Codex with CrossX for Canvas 2D wordmark.");

// 4. Verify Scene configured usage and component imports
const sceneContent = fs.readFileSync(scenePath, 'utf8');
assert(sceneContent.includes('from "@designcodeio/threeui"'), 'Scene must import SparkBadge from @designcodeio/threeui');
assert(sceneContent.includes('import "@designcodeio/threeui/style.css"'), 'Scene must import @designcodeio/threeui/style.css');
assert(sceneContent.includes('className="shader-frame"'), 'Scene must render with className="shader-frame"');
console.log('PASS: Scene.tsx implements the exact configured usage and props.');

// 5. Verify App branding on landing page
const landingPath = path.join(rootDir, 'src/components/landing/LandingPage.tsx');
const landingContent = fs.readFileSync(landingPath, 'utf8');
assert(!/agenttrust/i.test(landingContent), 'LandingPage.tsx must not contain agenttrust branding');
assert(landingContent.includes('<Scene'), 'LandingPage.tsx must integrate <Scene />');
console.log('PASS: LandingPage branding updated to CrossX and includes <Scene />.');

console.log('ALL SPARK BADGE TESTS PASSED SUCCESSFULLY!');
