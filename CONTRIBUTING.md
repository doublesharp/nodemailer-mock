# Contributing

Use this guide for changes to `nodemailer-mock`. Maintainers preparing a version
should also follow the [release runplan](docs/RELEASING.md).

## Set up

Use Node.js 24 for development and also test on Node.js 22, matching
[CI](.github/workflows/ci.yml). Install the exact pnpm version in the
`packageManager` field of [package.json](package.json), currently `pnpm@11.21.0`.
These are development requirements; consumers must meet the requirements of their
installed Nodemailer version.

```sh
git clone https://github.com/doublesharp/nodemailer-mock.git
cd nodemailer-mock
git switch -c feature/describe-your-change
pnpm --version
pnpm install --frozen-lockfile
```

For an existing checkout, check `git status` and preserve any unrelated work before
creating a branch. The install runs `prepare` to rebuild `dist/`.

## Make the change

1. Describe the problem and expected behavior in an issue or pull request. Include
   the Node.js, Nodemailer, and `nodemailer-mock` versions for a bug report.
2. For a bug, add a regression test that fails before the fix. Implement library
   changes in `src/`; the ESM wrapper lives in `mjs/`. Generated `dist/` files are
   rebuilt and are not committed.
3. Add coverage in `test/nodemailer-mock-tests.ts` and, for module-loading changes,
   `test/nodemailer-mock-tests.mjs`. Put public TypeScript compatibility cases in
   `test/types/`, including CommonJS and ESM consumers when relevant.
4. Update runnable examples in `examples/` when usage changes. Keep examples
   isolated from real email delivery.
5. Review the diff for correctness, unnecessary work, state leakage between tests,
   callback/Promise error handling, and compatibility with supported Nodemailer
   majors. Keep each pull request focused.

## Update documentation with the code

| Change | Documentation to update |
| --- | --- |
| Public API, behavior, defaults, or types | README API descriptions and examples; relevant source comments |
| Nodemailer or Node.js compatibility | README support statement; package metadata; test matrix and contributor/release instructions as appropriate |
| Commands, tooling, or contribution process | This guide and `docs/RELEASING.md` |
| Packaging, versioning, CI, or publication | `docs/RELEASING.md` and the affected workflow |
| User-visible feature, fix, or dependency/security change | A concise entry under `Unreleased` in `CHANGELOG.md` |

Use `Added`, `Changed`, `Fixed`, `Removed`, or `Security` changelog categories as
needed. Explain the observable result and link an issue or PR when useful. Do not
claim a vulnerability is fixed without checking the resolved dependency tree and
running an audit. Ordinary contribution PRs leave `package.json`'s version alone;
the release PR selects and applies the next version.

## Dependencies

Use pnpm for dependency changes and commit `pnpm-lock.yaml` with `package.json`.
Do not introduce npm or Yarn lockfiles. Check runtime versus development versus
peer dependencies, upstream Node.js requirements, and supported peer ranges before
upgrading. Respect pnpm's configured release-age and build-script policies.

The project maintains overrides in both `pnpm-workspace.yaml` and `package.json`
for pnpm and npm respectively. Keep their intended resolutions consistent, using
each manager's syntax. Prefer a patched upstream dependency over a permanent
override when possible, and remove an override only after checking both dependency
resolution and tests.

Run `pnpm audit` after dependency changes. Investigate each warning; document any
unresolved advisory and its impact in the PR rather than hiding it with an audit
threshold or an unreviewed forced upgrade.

## Validate

Run from the repository root:

```sh
pnpm run quality
pnpm run nyc
pnpm run examples
pnpm run test:package
git diff --check
```

`quality` runs ESLint, builds and checks TypeScript (including consumer fixtures),
and runs Knip. `nyc` rebuilds and runs the test suite with coverage checks.
`examples` runs Jest, Mocha, Node.js's test runner, and Vitest. Run these on both
Node.js 22 and 24 for runtime, dependency, or tooling changes. For a docs-only
change, verify affected commands, relative links, and formatting; rerun executable
examples if their code changes.

`test:package` builds an archive and tests fresh CommonJS/ESM runtime and
TypeScript consumers using the installed development Nodemailer version. Pass an
exact supported version to check another baseline, for example
`pnpm run test:package 6.10.1`. Consumer installs use a temporary directory and a
configured release-age protection; they do not rewrite the repository lockfile.

CI also runs package consumers on Node.js 22 and 24 with Nodemailer 6.10.1,
7.0.13, 8.0.11, 9.1.1, and 10.0.9. These are exact tested baselines, not a claim
that every published patch was tested. For compatibility or packaging changes,
also perform the final-version package checks in the
[release runplan](docs/RELEASING.md).

## Submit a pull request

Include the problem, resulting behavior, linked issues, documentation changes, and
the exact checks and version combinations tested. Call out breaking changes and
unresolved failures. Review `git diff` and stage only the intended files. Do not
commit generated output, coverage, local credentials, or package archives.

Maintainers review and merge contributions before following the release runplan.
