#!/usr/bin/env node
/**
 * Redact common secrets/PII-like tokens from log/alert text before sharing or filing issues.
 * Usage:
 *   node scripts/redact-log.mjs --file path/to/log.txt
 *   echo "..." | node scripts/redact-log.mjs
 * Output: redacted text to stdout. No network calls, no file writes.
 */

import fs from 'node:fs';

function readInput() {
  const idx = process.argv.indexOf('--file');
  if (idx !== -1 && process.argv[idx + 1]) {
    return fs.readFileSync(process.argv[idx + 1], 'utf8');
  }
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function redact(input) {
  let s = String(input || '');
  const rules = [
    [/\b(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED_TOKEN]'],
    [/\b(sk|pk|rk)_(live|test)_[A-Za-z0-9]+/g, '[REDACTED_KEY]'],
    [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/g, '[REDACTED_JWT]'],
    [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]'],
    [/\+?\d[\d\s().-]{7,}\d/g, (m) => (m.replace(/\D/g, '').length >= 8 ? '[REDACTED_PHONE]' : m)],
    [/(postgres(?:ql)?:\/\/)([^@\s]+)@/gi, '$1[REDACTED_CREDENTIALS]@'],
    [/([?&](?:token|key|secret|password|signature|apikey|api_key)=)([^&\s]+)/gi, '$1[REDACTED]'],
    [/\b([A-Fa-f0-9]{32,})\b/g, (m) => (m.length >= 40 ? '[REDACTED_HEX]' : m)],
  ];
  for (const [re, rep] of rules) s = s.replace(re, rep);
  return s;
}

const input = readInput();
process.stdout.write(redact(input));
