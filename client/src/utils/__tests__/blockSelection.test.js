import { describe, it, expect } from 'vitest';
import {
  applyBlockClick,
  detectModifier,
  pruneSelection,
  MODIFIER_NONE,
  MODIFIER_CTRL,
  MODIFIER_SHIFT,
} from '../blockSelection.js';

describe('detectModifier', () => {
  it('returns NONE for a missing event', () => {
    expect(detectModifier(undefined)).toBe(MODIFIER_NONE);
    expect(detectModifier(null)).toBe(MODIFIER_NONE);
  });

  it('detects ctrl / meta / shift independently', () => {
    expect(detectModifier({ ctrlKey: true })).toBe(MODIFIER_CTRL);
    expect(detectModifier({ metaKey: true })).toBe(MODIFIER_CTRL);
    expect(detectModifier({ shiftKey: true })).toBe(MODIFIER_SHIFT);
  });

  it('combines ctrl + shift', () => {
    expect(detectModifier({ ctrlKey: true, shiftKey: true }))
      .toBe(MODIFIER_CTRL | MODIFIER_SHIFT);
  });
});

describe('applyBlockClick', () => {
  const order = ['a', 'b', 'c', 'd', 'e'];

  it('plain click replaces the selection with the clicked id', () => {
    const next = applyBlockClick({
      selected: new Set(['a', 'b']),
      order,
      clickedId: 'c',
      modifier: MODIFIER_NONE,
    });
    expect([...next]).toEqual(['c']);
  });

  it('plain click on the sole-selected id clears the selection (allowToggleOff)', () => {
    const next = applyBlockClick({
      selected: new Set(['c']),
      order,
      clickedId: 'c',
      modifier: MODIFIER_NONE,
      allowToggleOff: true,
    });
    expect([...next]).toEqual([]);
  });

  it('plain click on the sole-selected id is a no-op when toggle-off is disabled', () => {
    const next = applyBlockClick({
      selected: new Set(['c']),
      order,
      clickedId: 'c',
      modifier: MODIFIER_NONE,
      allowToggleOff: false,
    });
    expect([...next]).toEqual(['c']);
  });

  it('ctrl/cmd+click toggles a missing id in', () => {
    const next = applyBlockClick({
      selected: new Set(['a']),
      order,
      clickedId: 'c',
      modifier: MODIFIER_CTRL,
    });
    expect([...next].sort()).toEqual(['a', 'c']);
  });

  it('ctrl/cmd+click toggles a present id out', () => {
    const next = applyBlockClick({
      selected: new Set(['a', 'c']),
      order,
      clickedId: 'c',
      modifier: MODIFIER_CTRL,
    });
    expect([...next]).toEqual(['a']);
  });

  it('ctrl+click on a single item leaves the selection empty', () => {
    const next = applyBlockClick({
      selected: new Set(['c']),
      order,
      clickedId: 'c',
      modifier: MODIFIER_CTRL,
    });
    expect([...next]).toEqual([]);
  });

  it('shift+click range-selects forward from the anchor', () => {
    const next = applyBlockClick({
      selected: new Set(['a']),
      order,
      clickedId: 'd',
      lastClickedId: 'a',
      modifier: MODIFIER_SHIFT,
    });
    expect([...next].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('shift+click range-selects backward from the anchor', () => {
    const next = applyBlockClick({
      selected: new Set(['d']),
      order,
      clickedId: 'a',
      lastClickedId: 'd',
      modifier: MODIFIER_SHIFT,
    });
    expect([...next].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('shift+click falls back to the clicked id when the anchor is unknown', () => {
    const next = applyBlockClick({
      selected: new Set(),
      order,
      clickedId: 'c',
      lastClickedId: 'zzz',
      modifier: MODIFIER_SHIFT,
    });
    expect([...next]).toEqual(['c']);
  });

  it('shift+click adds to the existing selection (does not replace)', () => {
    const next = applyBlockClick({
      selected: new Set(['x']), // not in `order`
      order,
      clickedId: 'b',
      lastClickedId: 'a',
      modifier: MODIFIER_SHIFT,
    });
    expect([...next].sort()).toEqual(['a', 'b', 'x']);
  });

  it('ctrl+shift+click range-selects with toggle', () => {
    const next = applyBlockClick({
      selected: new Set(['a']),
      order,
      clickedId: 'c',
      lastClickedId: 'a',
      modifier: MODIFIER_CTRL | MODIFIER_SHIFT,
    });
    // When SHIFT and CTRL are both set, the shift branch wins (it
    // explicitly handles "add to selection"). Verify we get the full
    // range including the pre-selected 'a'.
    expect([...next].sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns a new Set (does not mutate the input)', () => {
    const original = new Set(['a']);
    const next = applyBlockClick({
      selected: original,
      order,
      clickedId: 'c',
      modifier: MODIFIER_NONE,
    });
    expect(next).not.toBe(original);
    expect([...original]).toEqual(['a']);
  });

  it('tolerates a missing order array', () => {
    const next = applyBlockClick({
      selected: new Set(),
      clickedId: 'c',
      modifier: MODIFIER_CTRL,
    });
    expect([...next]).toEqual(['c']);
  });
});

describe('pruneSelection', () => {
  it('drops ids that are no longer in the live set', () => {
    const out = pruneSelection(new Set(['a', 'b', 'c']), ['a', 'c']);
    expect([...out].sort()).toEqual(['a', 'c']);
  });

  it('returns an empty set when nothing overlaps', () => {
    const out = pruneSelection(new Set(['x', 'y']), ['a', 'b']);
    expect([...out]).toEqual([]);
  });

  it('handles an empty input selection', () => {
    expect([...pruneSelection(new Set(), ['a', 'b'])]).toEqual([]);
  });

  it('handles a missing live-id list', () => {
    expect([...pruneSelection(new Set(['a', 'b']))]).toEqual(['a', 'b']);
  });
});
