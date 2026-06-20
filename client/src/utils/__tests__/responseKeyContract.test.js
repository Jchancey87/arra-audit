import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const read = (rel) =>
  readFileSync(resolve(__dirname, rel), 'utf8');

describe('response key naming contract', () => {
  // The write side (LensPanel, useCompletionCheck) and the read side
  // (AuditDetail "Grouped by template lenses" branch) MUST use the same
  // key pattern: `lens-${lens}-${idx}`. If they drift, the Grouped
  // branch silently stops rendering — every audit falls through to the
  // raw-entries fallback, hiding the actual question text.
  const writePattern = /lens-\\\$\\{activeLens\\}-\\\$\\{i\\}/;
  const readPattern = /lens-\\\$\\{lens\\}-\\\$\\{idx\\}/;

  it('LensPanel writes responses with the lens-${lens}-${idx} pattern', () => {
    const src = read('../../components/audit/LensPanel.jsx');
    expect(src).toMatch(/`lens-\$\{activeLens\}-\$\{i\}`/);
  });

  it('useCompletionCheck reads responses with the same pattern', () => {
    const src = read('../../hooks/useCompletionCheck.js');
    expect(src).toMatch(/`lens-\$\{activeLens\}-\$\{i\}`/);
  });

  it('AuditDetail grouped branch reads responses with the same pattern', () => {
    const src = read('../../pages/AuditDetail.jsx');
    expect(src).toMatch(/`lens-\$\{lens\}-\$\{idx\}`/);
  });

  it('AuditDetail does NOT use the legacy ${lens}-q${idx} pattern', () => {
    const src = read('../../pages/AuditDetail.jsx');
    expect(src).not.toMatch(/`\$\{lens\}-q\$\{idx\}`/);
  });
});
