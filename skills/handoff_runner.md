# Skill: Handoff Execution Pipeline

Use this skill to take a handoff file, align on details, implement features, verify correctness, and deploy to the target environment.

---

## 📋 Execution Phases

### Phase 1: Ingestion & Analysis
1. Locate and view the designated handoff file (defaulting to [HANDOFF.md](file:///home/jackc/projects/arra/HANDOFF.md) unless specified otherwise).
2. Scan the "Next Steps", dependencies, and target architectural goals.
3. Identify existing files to analyze and gather necessary context from the codebase.

### Phase 2: Interactive Clarification ("Grill-Me")
1. Identify any missing details, ambiguous requirements, or potential edge cases.
2. Formulate 2-4 key clarifying questions. If appropriate, use the `ask_question` tool for structured feedback, or ask directly to align on design decisions.

### Phase 3: Architectural Planning
1. Design the technical solution adhering to the Ports & Adapters architecture described in [ARCHITECTURE_COMPLETE.md](file:///home/jackc/projects/arra/ARCHITECTURE_COMPLETE.md) and [REPOSITORY_PATTERN.md](file:///home/jackc/projects/arra/REPOSITORY_PATTERN.md).
2. Create or update the `implementation_plan.md` artifact detailing exactly what changes are planned and why.

### Phase 4: Implementation & Clean Coding
1. Modify the necessary client and server files using precise replacement tools.
2. Maintain documentation integrity, retaining existing comments and docstrings.
3. Use high-quality Title/Sentence Case typography rules as laid out in the UI guidelines.

### Phase 5: Verification & Testing
1. Run local unit/integration tests to ensure no regressions occur.
2. Run backend test suite:
   ```bash
   npm --prefix server test
   ```
3. Verify the client builds successfully if frontend changes were made:
   ```bash
   npm --prefix client run build
   ```

### Phase 6: Commit & PM2 Deployment
1. Stage and commit the changes:
   ```bash
   git add .
   git commit -m "feat: <feature description based on handoff>"
   ```
2. Execute the deployment script:
   ```bash
   ./deploy.sh
   ```
3. Run `pm2 status` to verify backend and frontend services are active and running.
