---
name: architecture-rule-audit
description: Audit a newly implemented or modified feature against the project's engineering rules. Use after feature development, before merge, or when asked to verify architecture/code quality rules.
---

# Architecture Rule Audit

## Mission

Inspect the code changed for the target feature and verify compliance with the engineering rules in `CLAUDE.md`. This is an evidence-based audit, not an automatic refactor.

## Procedure

1. **Identify scope**
   - Determine the feature and changed files using the diff and repository status.
   - Read the relevant parts of `CLAUDE.md` and inspect nearby code to understand project conventions.
   - If the target feature or change scope cannot be identified, ask one concise question.

2. **Trace the feature**
   - Follow the main path from entry point/UI through business logic and data access to its outputs.
   - Identify state ownership, module boundaries, dependencies, side effects, error paths, and tests.
   - Inspect enough surrounding code to verify claims; do not judge from filenames alone.

3. **Verify each rule**
   Check the applicable rules from `CLAUDE.md`:
   - Separation of concerns
   - High cohesion / low coupling
   - Dependency direction
   - Encapsulation and state ownership
   - SSOT
   - DRY
   - Explicit data flow / side effects
   - KISS / YAGNI
   - Testability
   - Input validation / error handling
   - Change scope / public contracts
   - Test, type-check, lint, and build verification

   For every rule, assign one status:
   - **PASS** — inspected evidence supports compliance.
   - **FAIL** — a concrete violation is found.
   - **WARN** — meaningful risk or design smell, but not a proven violation.
   - **N/A** — not applicable to this feature.
   - **UNVERIFIED** — insufficient evidence or a check could not be run.

4. **Gather evidence**
   - Cite file paths and line numbers where possible.
   - Explain the specific behavior or dependency that supports each finding.
   - For failures and warnings, state impact and the smallest practical remediation.
   - Distinguish confirmed defects from subjective design preferences.
   - Do not invent findings, tests, or command results.

5. **Run checks**
   - Discover the project's documented commands and package scripts.
   - Run relevant targeted tests first, then available type-check, lint, and build checks when practical.
   - Do not modify code during the audit unless the user explicitly asks for fixes.
   - If a command cannot run, report why and mark it UNVERIFIED.

6. **Report**
   - Summarize overall risk and the most important findings first.
   - Include a rule-by-rule status table with evidence.
   - List exact recommended fixes, prioritized as **P0** (blocking/correctness/security), **P1** (important architectural or regression risk), and **P2** (minor/maintainability).
   - State commands run and their outcomes.
   - Do not declare the feature fully verified if any material area remains UNVERIFIED.

## Output format

# Architecture Rule Audit — <feature>

**Scope:** <files/modules inspected>  
**Overall:** PASS / PASS WITH WARNINGS / FAIL / INCOMPLETE

## Findings
| Priority | Rule | Status | Evidence | Impact / recommended fix |
|---|---|---|---|---|

Include all applicable rules, including PASS and N/A statuses. Use `path/to/file:line` references where available.

## Verification
- `<command>` — PASS / FAIL / NOT RUN (reason)

## Conclusion
- Blocking issues:
- Important risks:
- Recommended next actions:

## Guardrails

- Audit the feature's actual diff and relevant call paths; do not audit the whole repository unless required.
- Do not treat every duplication as a DRY violation or every abstraction as good architecture.
- Do not recommend microservices, extra layers, or new abstractions without a concrete requirement.
- Prefer the smallest change that resolves a demonstrated problem.
- A clean test run does not prove architectural compliance; architecture checks require code inspection.
- Never silently edit files as part of an audit.
