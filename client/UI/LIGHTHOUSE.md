# Lighthouse CI gate — setup + workflow

Phase 4.1 of the audit panel work. The goal is a fast, repeatable
"are we still above baseline?" check that can be wired into CI later
without re-architecting.

## What runs

`scripts/lighthouse.mjs` — a single-file Node script that:

1. Detects a usable Chrome on the host (system or Playwright cache).
2. Runs `lighthouse@12` against a target URL with the four standard
   categories (performance, accessibility, best-practices, seo).
3. Compares each score against a threshold; fails the run if any
   category is below.
4. Writes the JSON report to `client/UI/lighthouse-report.json` for
   later inspection (and an HTML copy when re-run with `--view`).

## Exit codes

| code | meaning                                                   |
|------|-----------------------------------------------------------|
| 0    | all categories at or above threshold                     |
| 1    | gate FAILED — one or more categories below                |
| 2    | lighthouse itself errored (network, audit, bad config)    |
| 77   | SKIPPED — no Chrome with the required system libs         |

CI convention: treat 77 as a yellow card (the workflow stays green,
the audit step is reported as `skipped`). 0 = pass, 1 = fail.

## Running locally

```bash
cd client
npm run build         # writes client/build
npm run lighthouse    # builds + previews + audits + tears down
```

The npm script handles the `vite preview` lifecycle for you. If you
want to point at a different server:

```bash
node scripts/lighthouse.mjs \
  --url http://localhost:5050 \
  --report client/UI/lighthouse-report.json \
  --thresholds performance=85,accessibility=95,best-practices=90,seo=80
```

## Default thresholds

```js
performance:    90
accessibility:  95
best-practices: 90
seo:            80
```

These are starting numbers for the live `arra.homma.casa` build
(runs against the live dev backend with seed data). Tighten them as
the project stabilizes.

## Chrome detection (the gotcha)

`chrome-launcher` (which Lighthouse depends on) needs a Chrome binary
with the standard Debian/Chromium system libraries:

```
libnspr4 libnss3 libxss1 libgbm1 libasound2 ...
```

On the Arra dev host (Debian 13, headless), the system doesn't have a
package manager entry for these by default, and `apt-get install`
fails without sudo. The Playwright-bundled Chromium (`~/.cache/
ms-playwright/chromium-1228`) has the same dep gap. The script
detects this and exits 77 with a clear message instead of failing
cryptically.

### Fix it once

```bash
sudo apt-get update
sudo apt-get install -y libnspr4 libnss3 libxss1 libgbm1 libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcups2 libdrm2 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libpango-1.0-0 \
  libcairo2 libgtk-3-0
```

After that, `npm run lighthouse` produces a real report.

## CI integration (future)

When wiring into GitHub Actions or similar:

```yaml
- name: Install Chromium deps (Ubuntu)
  run: sudo apt-get install -y libnspr4 libnss3 libxss1 libgbm1 libasound2 ...
- name: Build
  run: cd client && npm ci && npm run build
- name: Lighthouse gate
  run: cd client && npm run lighthouse
```

`npm run lighthouse` already exits 1 on threshold failure, so the
step fails the workflow without extra glue.

## Manual a11y walkthrough (companion to the gate)

The Lighthouse a11y category catches most of the WCAG-AA audit rules
Lighthouse knows about. It's not a substitute for a real
screen-reader + keyboard walkthrough. The companion checklist lives
in `AC_AUDIT.md` and is updated as the panel evolves.

The walkthrough sequence (per session, ~10 min):

1. Open Dashboard. Tab through every interactive element. Confirm
   focus outline (AC-05) is visible everywhere.
2. Tab into a song → AuditForm. Toggle through the four lens tabs.
   Confirm `role="tabpanel"` and `aria-labelledby` are present
   (Phase 3.4).
3. Bookmark a moment, add a note, hit Save Draft. Confirm the
   "Saving..." → "Saved Ns ago" status announces (AC-07).
4. Open AuditDetail. Verify the share link copy button shows
   "Copied" feedback.
5. Export PDF. Open the result in Preview/Acrobat. Verify it's
   selectable text (not a baked image).
6. Zoom to 200% (browser zoom). Verify the layout doesn't break
   (AC-09). The Phase 4.2 responsive blocks should kick in below
   1200px and 768px.

Anything you can't tab to, anything that doesn't announce, anything
that breaks at 200% is a finding for the next iteration.
