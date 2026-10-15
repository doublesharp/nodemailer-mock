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
- Refresh compatible dependencies and clear full/production audit findings before release; keep unrelated source changes out of scope.
- Every runtime fix/new API receives regression tests with red/green evidence.

## Task 1: Runtime isolation and optional response simulation

Worktree: /Users/justin/.codex/worktrees/library-improvements/nodemailer-mock
Files: src/nodemailer-mock.ts, src/lib/messages.ts, new test/nodemailer-mock-runtime-tests.ts, optional focused src/lib/response.ts, test/types fixtures for new APIs.
Requirements: implement items 1, 2, and 6 together because they share runtime state and result types. Follow the [approved design](../specs/2026-10-14-library-improvements-design.md). Provide getMockFor options for realistic mode and a factory ID generator, typed setSentMessageInfo/queueResult, and reset({ clearTransporters: true }).
- [x] Write and run failing isolation, reset, and simulation regressions.
- [x] Implement the smallest backward-compatible runtime and typed APIs.
- [x] Run focused tests, existing suite, lint, and type checks.
- [x] Commit only runtime and runtime-test files; write task-1-report.md.
- [x] Independent spec and quality review, then repair any important findings.

## Task 2: Custom transport TypeScript compatibility

Worktree: /Users/justin/.codex/worktrees/mock-type-compatibility/nodemailer-mock
Files: src/nodemailer-mock.ts, test/types/imports.ts, test/types/imports.mts.
Requirements: accept Transport<{ id: number }> wherever transport arguments are accepted, while sendMail still returns the mock result.
- [x] Add typed fixtures where real Nodemailer accepts a custom transport but the mock currently rejects it; record TS2345.
- [x] Broaden the transport input type in the public interface, implementation, and transport constructor, with consistent exported signatures.
- [x] Rebuild and run type fixtures and focused runtime custom-transport smoke checks.
- [x] Commit only this task's files; write task-2-report.md.
- [x] Independent spec and quality review, then repair any important findings.

## Task 3: Public ESM entrypoint and packaged compatibility CI

Worktree: /Users/justin/.codex/worktrees/mock-package-compatibility/nodemailer-mock
Files: package.json, mjs/, .github/workflows/ci.yml, test/package/, scripts/, package/module tests, appropriate knip and build configuration if needed.
Requirements: implement review items 4 and 5. Route native ESM through a wrapper that preserves the CommonJS exports-object default, add a matching .d.mts wrapper, and test the public package through pnpm run test:package [exact-version].
- [x] Add a failing default-import test for the advertised wrapper and fixtures using the public package name.
- [x] Fix wrapper/default/type exports, preserving shared singleton behavior and CommonJS compatibility.
- [x] Add an isolated archive-consumer compatibility runner and Node 22/24 × Nodemailer 6–10 CI jobs using exact eligible versions.
- [x] Validate build, root import tests, type fixtures, and at least the locked Nodemailer packaged consumer locally.
- [x] Commit scoped files; write task-3-report.md including any matrix environments not run locally.
- [x] Independent spec and quality review, then repair any important findings.

## Task 4: Compatible dependency refresh and audit remediation

Worktree: /Users/justin/.codex/worktrees/mock-dependency-refresh/nodemailer-mock
Files: package.json dependency/override fields, pnpm-workspace.yaml, pnpm-lock.yaml.
Requirements: the user explicitly added compatible package updates and audit fixes before release. Preserve pnpm11.21.0 and the effective release-age/build policies; keep TypeScript below7 while ts-jest requires it. Use upstream patched dependencies and narrow consistent overrides, with no audit suppression.
- [x] Install an independent frozen dependency tree and capture baseline outdated/audit results.
- [x] Select compatible eligible releases, respecting minimum release age and build policy.
- [x] Prefer upstream fixes, use narrow patched overrides where required, and keep npm/pnpm overrides aligned.
- [x] Run quality, coverage, examples, and full/production audits; require zero audit findings.
- [x] Commit scoped dependency files; write task-4-report.md with exact versions and holds.
- [x] Independent spec and quality review, then repair any important findings.

## Integration and release

- [x] Integrate task 2, 3, and 4 commits into task 1's branch; resolve only intended changes.
- [x] Update README, CHANGELOG, CONTRIBUTING, and docs/RELEASING.md for the final API and matrix.
- [x] Run lint, typecheck, knip, coverage, all examples and the isolated package matrix with final source.
- [ ] Request a broad final branch review; repair and reverify covering checks.
- [x] Choose and verify an unused minor version, prepare release notes, inspect the archive.
- [ ] Push reviewed work, open/attach a PR, and complete the authorized shipping workflow when credentials and checks permit.
- [ ] Record exact source, CI, and npm outcomes separately. Archive temporary task worktrees after preserving integrated commits and evidence.
