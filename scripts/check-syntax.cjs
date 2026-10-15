#!/usr/bin/env node
'use strict';

// Lightweight syntax-only validation for this mixed static-site / Vercel /
// Apps Script project. It requires only Node.js and does not install packages.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const failures = [];
let checked = 0;

function runCheck(source, mode, label) {
  const args = mode === 'module'
    ? ['--input-type=module', '--check']
    : ['--check'];
  const result = spawnSync(process.execPath, args, {
    cwd: root,
    input: source,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024
  });
  checked += 1;
  if (result.status !== 0) {
    failures.push(`${label}\n${(result.stderr || result.stdout || 'Unknown parser error').trim()}`);
  }
}

function walk(dir, callback) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, callback);
    else callback(full);
  }
}

walk(path.join(root, 'js'), file => {
  if (!file.endsWith('.js') || file.endsWith('.min.js')) return;
  runCheck(fs.readFileSync(file, 'utf8'), 'module', path.relative(root, file));
});

walk(path.join(root, 'api'), file => {
  if (!file.endsWith('.js') || file.endsWith('.min.js')) return;
  runCheck(fs.readFileSync(file, 'utf8'), 'script', path.relative(root, file));
});

// Service worker is a classic browser script.
runCheck(fs.readFileSync(path.join(root, 'sw.js'), 'utf8'), 'script', 'sw.js');

// Apps Script runs JavaScript with Google-provided globals; this confirms
// parsing only, not the availability or behavior of Apps Script services.
runCheck(fs.readFileSync(path.join(root, 'Code.gs'), 'utf8'), 'script', 'Code.gs');

// Check inline browser scripts without executing them. External <script src>
// files are covered separately above where applicable.
for (const htmlFile of ['index.html', 'app.html', 'newForm.html', 'tgpForm.html', 'privacy-policy.html', 'terms-of-service.html', '404.html']) {
  const html = fs.readFileSync(path.join(root, htmlFile), 'utf8');
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let match;
  let inlineIndex = 0;
  while ((match = scriptPattern.exec(html)) !== null) {
    if (/\bsrc\s*=/.test(match[1])) continue;
    // JSON-LD is structured data, not executable JavaScript.
    if (/\btype\s*=\s*["']application\/ld\+json["']/i.test(match[1])) continue;
    inlineIndex += 1;
    const type = /\btype\s*=\s*["']module["']/i.test(match[1]) ? 'module' : 'script';
    const source = match[2].trim();
    if (!source) continue;
    runCheck(source, type, `${htmlFile} inline script #${inlineIndex}`);
  }
}

if (failures.length) {
  process.stderr.write(`Syntax check failed (${failures.length} failure(s), ${checked} checks).\n\n${failures.join('\n\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Syntax check passed: ${checked} JavaScript sources/inline scripts parsed.\n`);
