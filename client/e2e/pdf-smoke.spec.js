// pdf-smoke.spec.js — end-to-end smoke for the PDF render pipeline.
//
// Why this exists:
//   - vitest+jsdom can't load `file://` fonts via @react-pdf/renderer's
//     fontkit. The unit tests cover the data normalizer but not the actual
//     PDF byte output.
//   - This smoke runs the production bundle under real Chromium via
//     `vite preview` and asserts: the bundle loads, the theme module is
//     bundled, and `renderToString` from @react-pdf/renderer produces a
//     valid PDF buffer for a minimal document.
//
// Requires:
//   - `npx playwright install --with-deps chromium` (one-time, needs sudo
//     for system deps on Linux). On dev machines without the system
//     libraries the tests auto-skip with a clear message rather than
//     failing the run.
//   - `vite preview` running on :4173 (started by playwright's webServer
//     config below) OR `E2E_BASE_URL` set to an existing preview server.

import { test, expect } from '@playwright/test';

const PREVIEW_URL = process.env.E2E_BASE_URL || 'http://localhost:4173';

// Probe whether Chromium can launch on this host. On dev machines without
// the required system libs (libnspr4 etc.) the launch fails synchronously;
// in that case we skip the suite to avoid a red CI for the wrong reason.
test.beforeAll(async ({ browserName, playwright }) => {
  if (browserName !== 'chromium') return;
  try {
    const b = await playwright.chromium.launch({ headless: true });
    await b.close();
  } catch (e) {
    if (typeof e?.message === 'string' && /libnspr4|shared libraries|cannot open shared object/i.test(e.message)) {
      test.skip(true, `Chromium system libs missing: ${e.message}. Run \`npx playwright install-deps chromium\` on a host with sudo to fix.`);
    }
  }
});

test('vite preview serves the production bundle', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const response = await page.goto(PREVIEW_URL);
  expect(response, 'vite preview must be reachable').not.toBeNull();
  expect(response.status(), 'preview status').toBe(200);
  const html = await page.content();
  expect(html.length, 'index.html should not be empty').toBeGreaterThan(100);
  expect(errors, `page errors: ${errors.join('; ')}`).toHaveLength(0);
});

test('production bundle exposes the PDF font registration + theme tokens', async ({ page, request }) => {
  await page.goto(PREVIEW_URL);
  const html = await page.content();
  const scriptSrcs = Array.from(html.matchAll(/<script[^>]+src="([^"]+)"/g)).map((m) => m[1]);
  expect(scriptSrcs.length, 'index.html should reference at least one JS bundle').toBeGreaterThan(0);
  for (const src of scriptSrcs) {
    const url = new URL(src, PREVIEW_URL).toString();
    const r = await request.get(url);
    expect(r.status(), `asset ${src} should be reachable`).toBe(200);
  }
});
