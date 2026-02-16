#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function fail(msg) {
  console.error(`PREMERGE CHECK FAILED: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

function readFileOrFail(filePath) {
  if (!fs.existsSync(filePath)) fail(`Missing file ${filePath}`);
  return fs.readFileSync(filePath, 'utf8');
}

function walkFiles(dir, filterFn, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, filterFn, acc);
    } else if (filterFn(full)) {
      acc.push(full);
    }
  }
  return acc;
}

function extractGuardBlocks(content, guardText) {
  const blocks = [];
  let searchIdx = 0;
  while (true) {
    const ifIdx = content.indexOf(guardText, searchIdx);
    if (ifIdx === -1) break;

    const braceStart = content.indexOf('{', ifIdx);
    if (braceStart === -1) break;

    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < content.length; i++) {
      const ch = content[i];
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }

    if (end === -1) break;
    blocks.push(content.slice(braceStart, end + 1));
    searchIdx = end + 1;
  }
  return blocks;
}

const root = process.cwd();
const routesPath = path.join(root, 'src', 'server', 'routes', 'index.ts');
const configPath = path.join(root, 'data', 'bot-config.json');
const guardText = "if (process.env.NODE_ENV !== 'production')";

const routesContent = readFileOrFail(routesPath);

if (!routesContent.includes(guardText)) {
  fail('Missing non-production guard block in routes.');
}
ok('Found non-production guard block in routes');

const protectedRoutes = [
  '/daily-reminders/test-ping',
  '/test/simple-message',
  '/test/simple-config',
  '/chats/diagnostics/visual',
  '/chats/diagnostics/chat-load'
];

const guardBlocks = extractGuardBlocks(routesContent, guardText);
if (guardBlocks.length === 0) fail('Could not parse guarded route blocks.');

for (const route of protectedRoutes) {
  const totalOccurrences = routesContent.split(route).length - 1;
  const guardedOccurrences = guardBlocks.reduce((acc, block) => acc + (block.split(route).length - 1), 0);

  if (totalOccurrences === 0) fail(`Expected debug route not found: ${route}`);
  if (totalOccurrences !== guardedOccurrences) {
    fail(`Route ${route} is exposed outside non-production guard.`);
  }
  ok(`Route protected by environment guard: ${route}`);
}

// Security: ensure secrets are redacted from persisted config
let config;
try {
  config = JSON.parse(readFileOrFail(configPath));
} catch (err) {
  fail(`Invalid JSON in ${configPath}`);
}

if (config.geminiApiKey !== null) fail('data/bot-config.json geminiApiKey must be null');
if (!config.aiConfig || typeof config.aiConfig !== 'object') fail('data/bot-config.json aiConfig missing');
if (config.aiConfig.geminiApiKey !== null) fail('data/bot-config.json aiConfig.geminiApiKey must be null');
if (config.aiConfig.groqApiKey !== null) fail('data/bot-config.json aiConfig.groqApiKey must be null');
ok('Secrets are redacted in data/bot-config.json');

// Code hygiene: enforce no console.* in all server controllers/routes
const enforcedFiles = [
  ...walkFiles(path.join(root, 'src', 'server', 'controllers'), f => f.endsWith('.ts')),
  ...walkFiles(path.join(root, 'src', 'server', 'routes'), f => f.endsWith('.ts'))
];
const consolePattern = /\bconsole\.(log|warn|error|debug)\s*\(/g;

for (const filePath of enforcedFiles) {
  const content = readFileOrFail(filePath);
  if (consolePattern.test(content)) {
    fail(`console.* usage detected in ${path.relative(root, filePath)}`);
  }
  ok(`No console.* in ${path.relative(root, filePath)}`);
}

// API contract sanity for critical controllers
const controllerDir = path.join(root, 'src', 'server', 'controllers');
const criticalControllers = [
  path.join(controllerDir, 'dailyReminderController.ts'),
  path.join(controllerDir, 'aiController.ts'),
  path.join(controllerDir, 'analyticsController.ts'),
  path.join(controllerDir, 'dataController.ts')
];

for (const filePath of criticalControllers) {
  const content = readFileOrFail(filePath);
  if (!content.includes('success: true')) {
    fail(`${path.relative(root, filePath)} missing success: true response shape`);
  }
  if (!content.includes('success: false')) {
    fail(`${path.relative(root, filePath)} missing success: false response shape`);
  }
  ok(`Response contract markers found in ${path.relative(root, filePath)}`);
}

console.log('PREMERGE CHECK PASSED');
