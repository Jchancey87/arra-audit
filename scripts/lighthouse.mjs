/**
 * Lighthouse CI gate.
 *
 * Runs a Lighthouse audit against a running preview server and asserts
 * the scores are at or above the configured thresholds. Exits with code
 * 1 if any category falls short, so a `npm run lighthouse` failure in
 * CI blocks the merge.
 *
 * Usage:
 *   npm run build         # client/build must be up to date
 *   npm run lighthouse    # boots vite preview, audits, tears down
 *
 * The script can be invoked directly:
 *   node scripts/lighthouse.mjs \
 *     --url http://localhost:4173 \
 *     --thresholds perf=90,a11y=95,best-practices=90,seo=80 \
 *     --report client/UI/lighthouse-report.json
 *
 * Exit codes:
 *   0  — all categories at or above thresholds
 *   1  — one or more categories below threshold (gate fail)
 *   2  — lighthouse itself errored (network, audit failure)
 *   77 — SKIPPED (no usable Chrome on the host; the script tells the
 *         caller what to install). CI should treat 77 as a yellow card,
 *         not a red one.
 *
 * Chrome detection: we look for a system chrome/chromium first, then
 * the Playwright cache (~/.cache/ms-playwright). If neither is runnable
 * (e.g. missing libnspr4), we skip. Installing the deps is documented
 * in client/UI/LIGHTHOUSE.md.
 */

import { spawn, spawnSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

const DEFAULT_URL = process.env.LIGHTHOUSE_URL || 'http://localhost:4173';
const DEFAULT_REPORT = 'client/UI/lighthouse-report.json';
const DEFAULT_THRESHOLDS = {
  performance: 90,
  accessibility: 95,
  'best-practices': 90,
  seo: 80,
};

const SKIPPED_EXIT_CODE = 77;

const parseArgs = (argv) => {
  const out = { url: DEFAULT_URL, report: DEFAULT_REPORT, thresholds: { ...DEFAULT_THRESHOLDS } };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--url') out.url = argv[++i];
    else if (arg === '--report') out.report = argv[++i];
    else if (arg === '--thresholds') {
      for (const pair of argv[++i].split(',')) {
        const [k, v] = pair.split('=');
        if (k && v) out.thresholds[k] = Number(v);
      }
    } else if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/lighthouse.mjs [--url URL] [--report PATH] [--thresholds k=v,k=v]');
      process.exit(0);
    }
  }
  return out;
};

/**
 * Find a usable Chrome binary. Returns the path or null. We test that
 * the binary actually runs (--version) so a Playwright cache with
 * missing system libs (e.g. libnspr4) doesn't get us stuck in a
 * confusing Lighthouse failure.
 */
const findChrome = () => {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    process.env.HOME + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
    process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell',
  ].filter(Boolean);
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const r = spawnSync(path, ['--version'], { stdio: 'pipe', timeout: 5000 });
    if (r.status === 0 && r.stdout.toString().trim().length > 0) return path;
  }
  return null;
};

const runLighthouse = async (url, reportPath, chromePath) => {
  const tmpReport = `${reportPath}.tmp`;
  const env = { ...process.env, CHROME_PATH: chromePath };
  const args = [
    '--yes',
    'lighthouse@12',
    url,
    '--output=json',
    `--output-path=${tmpReport}`,
    '--only-categories=performance,accessibility,best-practices,seo',
    '--chrome-flags="--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage"',
    '--quiet',
    '--max-wait-for-load=45000',
  ];
  console.log(`[lighthouse] CHROME_PATH=${chromePath}`);
  console.log(`[lighthouse] running: npx ${args.join(' ')}`);
  await new Promise((resolve, reject) => {
    const child = spawn('npx', args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`lighthouse exited with code ${code}`));
    });
  });
  if (!existsSync(tmpReport)) {
    throw new Error(`lighthouse did not write ${tmpReport}`);
  }
  const data = JSON.parse(readFileSync(tmpReport, 'utf8'));
  writeFileSync(reportPath, JSON.stringify(data, null, 2));
  return data;
};

const extractScores = (report) => {
  const out = {};
  for (const [key, cat] of Object.entries(report.categories || {})) {
    out[key] = Math.round((cat.score || 0) * 100);
  }
  return out;
};

const checkThresholds = (scores, thresholds) => {
  const failures = [];
  for (const [k, min] of Object.entries(thresholds)) {
    const got = scores[k];
    if (typeof got !== 'number') {
      failures.push({ key: k, min, got: 'N/A', reason: 'category not scored' });
    } else if (got < min) {
      failures.push({ key: k, min, got, reason: 'below threshold' });
    }
  }
  return failures;
};

const a11yFindings = (report) => {
  const a11y = report.categories?.accessibility;
  if (!a11y) return [];
  return (a11y.auditRefs || [])
    .map((ref) => report.audits?.[ref.id])
    .filter((a) => a && a.score !== null && a.score < 1)
    .map((a) => ({ id: a.id, title: a.title, score: a.score }));
};

const main = async () => {
  const { url, report, thresholds } = parseArgs(process.argv);
  const reportPath = resolve(report);
  mkdirSync(dirname(reportPath), { recursive: true });

  console.log(`[lighthouse] target: ${url}`);
  console.log(`[lighthouse] report: ${reportPath}`);
  console.log(`[lighthouse] thresholds:`, thresholds);

  const chromePath = findChrome();
  if (!chromePath) {
    console.warn('[lighthouse] SKIPPED — no usable Chrome found.');
    console.warn('  Tried: $CHROME_PATH, /usr/bin/{google-chrome,chromium}, ~/.cache/ms-playwright/{chromium,chromium_headless_shell}-1228.');
    console.warn('  Either install libnspr4+libnss3+libxss1+libgbm1+libasound2 (apt)');
    console.warn('  or set CHROME_PATH=/path/to/chrome. See client/UI/LIGHTHOUSE.md.');
    process.exit(SKIPPED_EXIT_CODE);
  }

  let data;
  try {
    data = await runLighthouse(url, reportPath, chromePath);
  } catch (err) {
    console.error(`[lighthouse] FAILED to run: ${err.message}`);
    process.exit(2);
  }

  const scores = extractScores(data);
  console.log('[lighthouse] scores:');
  for (const [k, v] of Object.entries(scores)) {
    const min = thresholds[k] ?? '?';
    const ok = typeof v === 'number' && v >= (min ?? 0);
    console.log(`  ${ok ? '✅' : '❌'} ${k.padEnd(16)} ${v} (threshold ${min})`);
  }

  const failures = checkThresholds(scores, thresholds);
  if (failures.length > 0) {
    console.error(`[lighthouse] ${failures.length} threshold(s) failed:`);
    for (const f of failures) console.error(`  - ${f.key}: ${f.got} < ${f.min} (${f.reason})`);
  }

  const a11y = a11yFindings(data);
  if (a11y.length > 0) {
    console.warn(`[lighthouse] ${a11y.length} a11y audit(s) below 1.0:`);
    for (const f of a11y) console.warn(`  - [${f.score}] ${f.id} — ${f.title}`);
  }

  console.log(`[lighthouse] JSON report: ${reportPath}`);
  console.log(`[lighthouse] HTML report: run \`npx lighthouse ${url} --view\` (re-uses cached report)`);

  if (failures.length > 0) {
    process.exit(1);
  }
  console.log('[lighthouse] PASS — all categories at or above thresholds');
};

main().catch((err) => {
  console.error('[lighthouse] unhandled error:', err);
  process.exit(2);
});

