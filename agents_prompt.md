# Agent Context Cleanup — Reusable Prompt

Paste this into any workspace to audit and tighten agent context files, reduce token waste, and optimize the opencode experience. Generic — no project-specific assumptions.

---

```
Audit and tighten my agent context files to optimize the opencode experience and reduce token waste. Do the following:

1. **Find the mandatory-read file(s)**: Check AGENTS.md / .opencode/ / CLAUDE.md / similar for any file the agent is instructed to read in full at every session start. That file is the highest-ROI pruning target — every line costs tokens on every single session.

2. **Prune the mandatory-read file**:
   - Dedupe any repeated entries (session log rows, red-line items, TODOs).
   - Collapse completed TODOs into a single "shipped" line or remove them entirely (detail belongs in devlogs, not the memory file).
   - Move feature-implementation descriptions (file lists, line counts, test tallies) out to the devlog — keep only the durable architectural constraint or one-line summary.
   - Trim the "resume point" / "done this session" section to a one-line pointer to the devlog, not a 7-item nested list.
   - Keep true red-lines (constraints that would cause regressions if violated) and active TODOs; cut everything else.

3. **Split the devlog**: If devlogs.md (or equivalent) is large, split it:
   - Active file keeps entries from the last ~1-2 weeks.
   - Older entries move to `devlogs-archive.md` with a header noting they're historical (git log is the canonical source).
   - Keep any reusable "Standard Workflows / Commands" section in the active file.
   - Add a one-line pointer at the top of the active file noting the archive exists.

4. **Fix stale skill/reference paths**: Search skills/ and any agent-configuration files for broken `file://` paths or references to old project names/locations (renames, moves, rebrands). Update to current paths.

5. **Regenerate auto-generated context**: If the repo uses SigMap / similar (check for gen-context.config.json, .github/copilot-instructions.md, .github/gemini-context.md), run the regen command (e.g. `npm run sigmap`) to refresh stale signatures.

6. **Clean opencode prompt history** (outside the repo, at ~/.local/state/opencode/prompt-history.jsonl): strip giant pasted `parts` content blocks while keeping the `input` summary strings for up-arrow recall. Make a `.bak` first. Valid JSONL must be preserved.

7. **Remove stale handoff files**: Handoff docs for completed work phases are dead weight — the agent may misread them as pending tasks. `git rm` them (git history preserves them). Keep only handoffs for work that is genuinely still open. Before removing, grep the mandatory-read file and active devlog for references — historical mentions are fine, but update any skill/rule that defaults to a deleted handoff filename.

Before committing, report: line-count before/after for each file, any duplicate entries found and removed, any stale paths fixed, any handoff files removed. Don't commit until I confirm. Don't touch source code — docs and config only.
```

---

## What this fixes

Agents that read a bloated memory file every session waste tokens re-ingesting completed work. Common symptoms:
- Session log tables with duplicate rows or 50+ entries spanning months
- Red-line / constraint sections that include feature descriptions instead of just the durable rule
- Resume points with 7-item nested lists of "done this session" detail that already lives in the devlog
- Devlogs that grew to 2000+ lines with entries from months ago
- Handoff files for completed phases confusing the agent into thinking there's pending work
- Stale `file://` paths referencing old project names or locations
- opencode prompt history bloated with giant pasted content blocks

## Token impact

For the Arra project (reference implementation), the first run cut:
- `agent_memory.md`: 136 → 62 lines (-54%) — read every session, so this is pure recurring savings
- `devlogs.md`: 2067 → 1213 lines (-41%) — 840 lines archived
- `prompt-history.jsonl`: 57 KB → 4.5 KB (-92%) — stripped pasted blocks, kept summaries
- 7 stale handoff files removed (git history preserves them)
