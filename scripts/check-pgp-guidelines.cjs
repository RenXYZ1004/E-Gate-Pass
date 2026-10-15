#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const form = fs.readFileSync(path.join(root, 'newForm.html'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'Code.gs'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const failures = [];
function assert(condition, message) { if (!condition) failures.push(message); }

const requiredPhrases = [
  'Permanent Gate Pass Guidelines — AY 2026–2027',
  'McDonald’s, 7-Eleven',
  'August 2026 through July 2027',
  'Homeroom Adviser or Discipline Officer',
  'December 2026',
  'By filling up this online form, I/we understand and have read the guidelines'
];
for (const phrase of requiredPhrases) assert(form.includes(phrase), `Form is missing required guideline text: ${phrase}`);
assert((form.match(/<li>/g) || []).length >= 7, 'Expected at least seven guideline list items (A–G).');
assert((form.match(/id="guidelinesAcknowledged"/g) || []).length === 1, 'Expected exactly one acknowledgment checkbox.');
assert(!/<input[^>]*id="guidelinesAcknowledged"[^>]*name=/i.test(form), 'Acknowledgment checkbox must not have a submission field name.');
assert(form.includes('if (!$("guidelinesAcknowledged").checked)'), 'Client-side validation must require acknowledgment.');
assert(!form.includes('guidelinesAcknowledged: $("guidelinesAcknowledged").checked'), 'Form must not send acknowledgment state to the backend.');
assert(!form.includes('guidelinesVersion:'), 'Form must not send a guideline version to the backend.');
assert(!backend.includes('data.guidelinesAcknowledged'), 'Backend must not validate or record acknowledgment state.');
assert(!backend.includes('GuidelinesAcknowledged'), 'Backend must not add or write an acknowledgment column.');
assert(!backend.includes('GuidelinesVersion'), 'Backend must not add or write a guideline version column.');
assert(!backend.includes('GuidelinesAcceptedAt'), 'Backend must not record an acceptance timestamp.');
assert(worker.includes("const CACHE_NAME = 'pgp-cache-v1.4.16'"), 'Service-worker cache version must be bumped.');
assert(worker.includes("'./newForm.html'"), 'Permanent form must be included in the app shell.');

if (failures.length) {
  console.error('PGP guideline checks failed:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('PGP guideline checks passed (guidelines A–G, required UI-only checkbox, no acknowledgment in request/backend, and service-worker cache).');
