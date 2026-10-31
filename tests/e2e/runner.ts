/**
 * Opaque-Box E2E Test Runner Orchestrator
 * Discovers, filters by tier, and executes test suites with summary reporting.
 */

import { run } from 'node:test';
import { spec as specReporter } from 'node:test/reporters';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './config.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

interface CliArgs {
  tier?: number;
  pattern?: string;
  help?: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tier' && args[i + 1]) {
      result.tier = parseInt(args[++i], 10);
    } else if (arg === '--pattern' && args[i + 1]) {
      result.pattern = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
RumahKita E2E Test Runner
Usage: node tests/e2e/runner.ts [options]

Options:
  --tier <1|2|3|4>    Execute only the tests belonging to the specified tier
  --pattern <regex>   Filter test files matching the regular expression
  --help, -h          Show this help message

Environment Variables:
  API_BASE_URL        Base URL of the target API (default: ${CONFIG.API_BASE_URL})
  TEST_TIMEOUT_MS     Per-request timeout in milliseconds (default: ${CONFIG.REQUEST_TIMEOUT_MS})
`);
}

function getFilesRecursively(dir: string): string[] {
  let files: string[] = [];
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files = files.concat(getFilesRecursively(fullPath));
    } else if (entry.endsWith('.test.ts') || entry.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

async function checkApiHealth(): Promise<boolean> {
  const url = `${CONFIG.API_BASE_URL.replace(/\/+$/, '')}/household`;
  console.log(`[Healthcheck] Verifying connectivity to ${url}...`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    // 401 is expected and healthy since /household is protected
    if ([200, 401, 403].includes(res.status)) {
      console.log(`[Healthcheck] API is reachable (HTTP ${res.status}). Proceeding with tests.\n`);
      return true;
    }
    console.warn(`[Healthcheck] Warning: API responded with unexpected status ${res.status}.\n`);
    return true;
  } catch (err: any) {
    console.error(`\n[Healthcheck Warning] Target API is currently unreachable at ${CONFIG.API_BASE_URL}.`);
    console.error(`Error: ${err.message}`);
    console.error(`Make sure the backend API server is running before executing live tests.\n`);
    return false;
  }
}

async function main(): Promise<void> {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  console.log('='.repeat(60));
  console.log(' RumahKita Opaque-Box E2E Test Suite');
  console.log(` Target API:  ${CONFIG.API_BASE_URL}`);
  if (args.tier) {
    console.log(` Tier Filter: Tier ${args.tier}`);
  }
  console.log('='.repeat(60) + '\n');

  await checkApiHealth();

  let targetDirs: string[] = [];
  if (args.tier === 1) {
    targetDirs = [join(__dirname, 'tier1-feature-coverage')];
  } else if (args.tier === 2) {
    targetDirs = [join(__dirname, 'tier2-boundary-corner')];
  } else if (args.tier === 3) {
    targetDirs = [join(__dirname, 'tier3-cross-feature')];
  } else if (args.tier === 4) {
    targetDirs = [join(__dirname, 'tier4-scenarios')];
  } else {
    targetDirs = [
      join(__dirname, 'tier1-feature-coverage'),
      join(__dirname, 'tier2-boundary-corner'),
      join(__dirname, 'tier3-cross-feature'),
      join(__dirname, 'tier4-scenarios'),
    ];
  }

  let files: string[] = [];
  for (const dir of targetDirs) {
    files = files.concat(getFilesRecursively(dir));
  }

  if (args.pattern) {
    const regex = new RegExp(args.pattern, 'i');
    files = files.filter(f => regex.test(f));
  }

  if (files.length === 0) {
    console.error('No matching test files found.');
    process.exit(1);
  }

  console.log(`Discovered ${files.length} test suite file(s). Running...\n`);

  const testStream = run({
    files,
    concurrency: false, // Run suites sequentially for isolation
  });

  let hasFailures = false;

  testStream.on('test:fail', () => {
    hasFailures = true;
  });

  testStream.compose(specReporter).pipe(process.stdout);

  testStream.on('end', () => {
    console.log('\n' + '='.repeat(60));
    if (hasFailures) {
      console.error(' [FAIL] One or more tests failed.');
      process.exit(1);
    } else {
      console.log(' [PASS] All test suites completed successfully.');
      process.exit(0);
    }
  });
}

main().catch(err => {
  console.error('Unexpected runner error:', err);
  process.exit(1);
});
