/**
 * Pure helpers for block multi-select logic in ArrangementTimelineWidget.
 *
 * Selection state is a Set<string> of block ids. The widget supports:
 *   - plain click       → replace selection with the clicked id
 *                         (empty if the clicked id was already the
 *                         sole selection; otherwise set to {clicked})
 *   - cmd/ctrl + click  → toggle the clicked id in the selection
 *   - shift + click     → range select between the last clicked id and
 *                         the new one (within the supplied `order` array,
 *                         which the caller scopes to the relevant kind)
 *   - escape            → caller clears the selection directly
 *
 * Block ids are assumed to be globally unique (the widget generates
 * them with Date.now() + random). Track blocks and section blocks share
 * the same id space but are stored in different structures, so the
 * caller can scope `order` to one kind at a time.
 */

export const MODIFIER_NONE = 0;
export const MODIFIER_CTRL = 1; // covers both ctrl and meta (cmd on mac)
export const MODIFIER_SHIFT = 2;

export const detectModifier = (event) => {
  if (!event) return MODIFIER_NONE;
  let m = MODIFIER_NONE;
  if (event.ctrlKey || event.metaKey) m |= MODIFIER_CTRL;
  if (event.shiftKey) m |= MODIFIER_SHIFT;
  return m;
};

export const isSelected = (selected, id) => selected instanceof Set && selected.has(id);

/**
 * Apply a click event to the current selection.
 * @param {object}   args
 * @param {Set<string>} args.selected    current selection
 * @param {string[]} args.order          all visible block ids in visual order
 *                                       (scoped to a single kind by caller)
 * @param {string}   args.clickedId
 * @param {string?}  args.lastClickedId  id of the previously-clicked block
 *                                       (used as the range-select anchor
 *                                       for shift-clicks)
 * @param {number}   args.modifier       bitfield of MODIFIER_*
 * @param {boolean}  args.allowToggleOff if true, plain-clicking the only
 *                                       selected id clears the selection;
 *                                       otherwise plain-click on a
 *                                       single-selected id is a no-op
 * @returns {Set<string>}
 */
export const applyBlockClick = ({
  selected,
  order,
  clickedId,
  lastClickedId,
  modifier = MODIFIER_NONE,
  allowToggleOff = true,
}) => {
  const next = new Set(selected || []);

  if (modifier & MODIFIER_SHIFT) {
    const anchor = lastClickedId && order.includes(lastClickedId) ? lastClickedId : clickedId;
    const start = order.indexOf(anchor);
    const end = order.indexOf(clickedId);
    if (start === -1 || end === -1) {
      next.add(clickedId);
    } else {
      const [lo, hi] = start <= end ? [start, end] : [end, start];
      for (let i = lo; i <= hi; i += 1) next.add(order[i]);
    }
    return next;
  }

  if (modifier & MODIFIER_CTRL) {
    if (next.has(clickedId)) next.delete(clickedId);
    else next.add(clickedId);
    return next;
  }

  // Plain click: replace with the clicked id (or clear if it was the
  // only selected and toggle-off is allowed).
  if (allowToggleOff && next.size === 1 && next.has(clickedId)) {
    return new Set();
  }
  return new Set([clickedId]);
};

/**
 * Reduce a list of block ids to only those still present in the data.
 * Used after a partial delete to drop dangling ids from the selection.
 * If `liveIds` is missing (caller forgot to pass it), the original
 * selection is returned unchanged — the safer default vs emptying.
 * @param {Set<string>} selected
 * @param {string[]?}   liveIds
 * @returns {Set<string>}
 */
export const pruneSelection = (selected, liveIds) => {
  if (!Array.isArray(liveIds)) return new Set(selected);
  const live = new Set(liveIds);
  const out = new Set();
  for (const id of selected) if (live.has(id)) out.add(id);
  return out;
};
