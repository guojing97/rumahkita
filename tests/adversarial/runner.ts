/**
 * Adversarial Test Runner Orchestrator
 * Executes all empirical adversarial suites with summary reporting.
 */

import { run } from 'node:test';
import { spec as specReporter } from 'node:test/reporters';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000/api/v1';

async function checkApiHealth(): Promise<boolean> {
  const url = `${API_BASE_URL.replace(/\/+$/, '')}/household`;
  console.log(`[Healthcheck] Verifying connectivity to ${url}...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if ([200, 401, 403].includes(res.status)) {
      console.log(`[Healthcheck] API is reachable (HTTP ${res.status}). Proceeding with adversarial tests.\n`);
      return true;
    }
    console.warn(`[Healthcheck] Warning: API responded with status ${res.status}.\n`);
    return true;
  } catch (err: any) {
    console.error(`\n[Healthcheck Error] Target API is unreachable at ${API_BASE_URL}.`);
    console.error(`Error: ${err.message}\n`);
    return false;
  }
}

async function main(): Promise<void> {
  console.log('='.repeat(65));
  console.log(' RumahKita Adversarial & Stress Empirical Test Runner');
  console.log(` Target API: ${API_BASE_URL}`);
  console.log('='.repeat(65) + '\n');

  const healthy = await checkApiHealth();
  if (!healthy) {
    process.exit(1);
  }

  const entries = readdirSync(__dirname);
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.endsWith('.test.ts')) {
      files.push(join(__dirname, entry));
    }
  }

  console.log(`Discovered ${files.length} adversarial test suite(s). Executing...\n`);

  const testStream = run({
    files,
    concurrency: false,
  });

  let hasFailures = false;

  testStream.on('test:fail', () => {
    hasFailures = true;
  });

  testStream.compose(specReporter).pipe(process.stdout);

  testStream.on('end', () => {
    console.log('\n' + '='.repeat(65));
    if (hasFailures) {
      console.error(' [FAIL] One or more adversarial tests failed.');
      process.exit(1);
    } else {
      console.log(' [PASS] All adversarial test suites passed successfully.');
      process.exit(0);
    }
  });
}

main().catch((err) => {
  console.error('Unexpected runner error:', err);
  process.exit(1);
});
