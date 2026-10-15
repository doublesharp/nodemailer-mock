# Library improvements implementation plan

> For agentic workers: use subagent-driven-development and test-driven-development. The user already selected subagent execution and approved the six review items.

**Goal:** Ship the six approved isolation, typing, packaging, compatibility, and response-simulation improvements.

**Architecture:** Preserve existing mock defaults. Add lifecycle fencing and typed, optional response simulation in the runtime. Keep type and packaging changes independent until integration.

**Tech stack:** TypeScript 6, Nodemailer 6–10, Mocha, pnpm, GitHub Actions.

## Global constraints

- Preserve legacy mock results and default TypeScript return types.
- Preserve documented CommonJS and ESM usage and shared singleton state.
- Retain Nodemailer 6–10 and the Node 22/24 verification matrix.
- Existing reset retains transporters/plugins; full cleanup is explicit.
- Old sends settle normally but never populate history after a reset boundary.
- No real delivery; verify and close delegation remain explicit controls.
- Keep dependency and unrelated source changes out of this release.
- Every runtime fix/new API receives regression tests with red/green evidence.

## Task 1: Runtime isolation and optional response simulation

Worktree: /Users/justin/.codex/worktrees/library-improvements/nodemailer-mock
Files: src/nodemailer-mock.ts, src/lib/messages.ts, new test/nodemailer-mock-runtime-tests.ts, optional focused src/lib/response.ts, test/types fixtures for new APIs.
Requirements: read task-1-brief.md in this directory. Implement items 1, 2, and 6 together because they share runtime state and result types.
- [ ] Write and run failing isolation, reset, and simulation regressions.
- [ ] Implement the smallest backward-compatible runtime and typed APIs.
- [ ] Run focused tests, existing suite, lint, and type checks.
- [ ] Commit only runtime and runtime-test files; write task-1-report.md.
- [ ] Independent spec and quality review, then repair any important findings.

## Task 2: Custom transport TypeScript compatibility

Worktree: /Users/justin/.codex/worktrees/mock-type-compatibility/nodemailer-mock
Files: src/nodemailer-mock.ts, test/types/imports.ts, test/types/imports.mts.
Requirements: read task-2-brief.md. Accept Transport<{ id: number }> wherever transport arguments are accepted, while sendMail still returns the mock result.
- [ ] Add typed fixtures where real Nodemailer accepts a custom transport but the mock currently rejects it; record TS2345.
- [ ] Broaden the transport input type in the public interface, implementation, and transport constructor, with consistent exported signatures.
- [ ] Rebuild and run type fixtures and focused runtime custom-transport smoke checks.
- [ ] Commit only this task's files; write task-2-report.md.
- [ ] Independent spec and quality review, then repair any important findings.

## Task 3: Public ESM entrypoint and packaged compatibility CI

Worktree: /Users/justin/.codex/worktrees/mock-package-compatibility/nodemailer-mock
Files: package.json, mjs/, .github/workflows/ci.yml, test/package/, scripts/, package/module tests, appropriate knip and build configuration if needed.
Requirements: read task-3-brief.md. Implement review items 4 and 5.
- [ ] Add a failing default-import test for the advertised wrapper and fixtures using the public package name.
- [ ] Fix wrapper/default/type exports, preserving shared singleton behavior and CommonJS compatibility.
- [ ] Add an isolated archive-consumer compatibility runner and Node 22/24 × Nodemailer 6–10 CI jobs using exact eligible versions.
- [ ] Validate build, root import tests, type fixtures, and at least the locked Nodemailer packaged consumer locally.
- [ ] Commit scoped files; write task-3-report.md including any matrix environments not run locally.
- [ ] Independent spec and quality review, then repair any important findings.

## Integration and release

- [ ] Integrate task 2 and 3 commits into task 1's branch; resolve only intended changes.
- [ ] Update README, CHANGELOG, CONTRIBUTING, and docs/RELEASING.md for the final API and matrix.
- [ ] Run lint, typecheck, knip, coverage, all examples and the isolated package matrix with final source.
- [ ] Request a broad final branch review; repair and reverify covering checks.
- [ ] Choose and verify an unused minor version, prepare release notes, inspect the archive.
- [ ] Push reviewed work, open/attach a PR, and complete the authorized shipping workflow when credentials and checks permit.
- [ ] Record exact source, CI, and npm outcomes separately. Archive temporary task worktrees after preserving integrated commits and evidence.
