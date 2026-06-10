# Agent System Directives & Performance Optimizations

## Session Startup — MANDATORY
- At the start of every session, before doing anything else, read `/home/jackc/projects/arra/agent_memory.md` in full.
- This file contains the file map, data models, design tokens, architecture patterns, known gotchas, open TODOs, and the session log. It is the fastest way to get oriented.
- After completing work each session, update the Session Log table in `agent_memory.md` with a one-line summary and the commit hash, and append a full entry to `devlogs.md`.

## Tooling & Search
- Prefer `rg` (ripgrep) over `grep` for text searches and file scanning.
- Exclude `node_modules`, `.venv`, `.git`, `dist`, and `build` from broad directory listings and searches unless the task explicitly targets them.
- Exclude lockfiles from broad searches unless working on dependencies, package resolution, or CI/debug issues.

## Token & Context Efficiency
- Avoid reading entire files over 200 lines when targeted ranges or chunks will answer the question.
- Prefer atomic search-and-replace edits over rewriting unchanged code blocks.

## Execution & Quality Assurance
- Use `&&` for short related command chains when it reduces turn count; split commands when intermediate inspection is useful.
- Use quiet flags like `-q` or `-s` when verbose output is unnecessary, but do not hide useful failure diagnostics.
- After modifying code, run the relevant local tests and lint checks before finalizing.
