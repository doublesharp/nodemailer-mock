# Contributing

For release steps, see the [release guide](docs/RELEASING.md).

## Set up

Develop on Node.js 24 and test on Node.js 22, matching
[CI](.github/workflows/ci.yml). Install the exact pnpm version in the
`packageManager` field of [package.json](package.json), currently `pnpm@11.21.0`.
Applications need a Node.js version supported by their installed Nodemailer version.

```sh
git clone https://github.com/doublesharp/nodemailer-mock.git
cd nodemailer-mock
git switch -c feature/describe-your-change
pnpm --version
pnpm install --frozen-lockfile
```

In an existing checkout, check `git status` before creating a branch and keep
unrelated changes out of your work. Installation runs `prepare` to rebuild `dist/`.

Build output normally goes to `dist/`. For local output redirection, `dist/` may
be a directory symlink; `clean` and `prepare` preserve it and recreate a missing
target directory. Package checks stage real copies of symlinked build files
before packing. Temporary directories follow `TMPDIR` when set in your local
shell. These local paths do not need to be committed.

## Make the change

1. Describe the problem and expected behavior in an issue or pull request. Include
   the Node.js, Nodemailer, and `nodemailer-mock` versions for a bug report.
2. For a bug, add a regression test that fails before the fix. Make library
   changes in `src/`; the ESM wrapper lives in `mjs/`. Generated `dist/` files are
   rebuilt during installation and testing. Do not commit them.
3. Add coverage in `test/nodemailer-mock-tests.ts` and, for module-loading changes,
   `test/nodemailer-mock-tests.mjs`. Put public TypeScript compatibility cases in
   `test/types/`, covering CommonJS and ESM when relevant.
4. Update runnable examples in `examples/` when usage changes. Keep examples
   isolated from real email delivery.
5. Review for state leaking between tests, callback and Promise errors, and
   compatibility with supported Nodemailer majors. Keep each pull request focused.

## Update documentation with the code

| Change | Documentation to update |
| --- | --- |
| Public API, behavior, defaults, or types | README API descriptions and examples; relevant source comments |
| Nodemailer or Node.js compatibility | README support statement; package metadata; test matrix and contributor/release instructions as appropriate |
| Commands, tooling, or contribution process | This guide and `docs/RELEASING.md` |
| Packaging, versioning, CI, or publication | `docs/RELEASING.md` and the affected workflow |
| User-visible feature, fix, or dependency/security change | A concise entry under `Unreleased` in `CHANGELOG.md` |

Use `Added`, `Changed`, `Fixed`, `Removed`, or `Security` changelog categories as
needed. Describe what changes for users and link an issue or PR when useful. Do not
claim a vulnerability is fixed without checking the resolved dependency tree and
running an audit. Ordinary contribution PRs leave `package.json`'s version alone;
maintainers bump it in the release PR.

## Dependencies

Use pnpm for dependency changes and commit `pnpm-lock.yaml` with `package.json`.
Do not add npm or Yarn lockfiles. Before upgrading, check which dependency type
applies, the dependency's Node.js requirements, and supported peer ranges. Follow
pnpm's configured release-age and build-script policies.

The project maintains overrides in both `pnpm-workspace.yaml` and `package.json`
for pnpm and npm respectively. Keep both managers resolving to the intended
versions, using each manager's syntax. Prefer a patched upstream dependency over
a permanent override when possible. Before removing an override, check dependency
resolution and run tests.

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

`quality` runs ESLint, builds and checks TypeScript, including consumer fixtures,
and runs Knip. `nyc` rebuilds and runs the test suite, requiring 100% statements,
branches, functions, and lines for every source file under `src/`.
`examples` runs Jest, Mocha, Node.js's test runner, and Vitest. Run these on both
Node.js 22 and 24 for runtime, dependency, or tooling changes. For a docs-only
change, verify affected commands, relative links, and formatting; rerun executable
examples if their code changes.

`test:package` builds an archive and tests fresh CommonJS/ESM runtime and
TypeScript consumers using the installed development Nodemailer version. Pass an
exact supported version to check another baseline, for example
`pnpm run test:package 6.10.1`. Consumer installs use temporary directories and
enforce the release-age policy. They do not rewrite the repository lockfile.
To create an archive after building, run `node scripts/pack.mjs <destination-directory>`;
this supports both ordinary and symlinked `dist/` directories.

CI also runs package consumers on Node.js 22 and 24 with Nodemailer 6.10.1,
7.0.13, 8.0.11, 9.1.1, and 10.0.9. Other patch versions are not covered by this
matrix. For compatibility or packaging changes, run the final-version package
checks in the [release guide](docs/RELEASING.md).

## Submit a pull request

Describe the problem and fix. Include linked issues, documentation changes, and
the checks and version combinations tested. Call out breaking changes and
unresolved failures. Review `git diff` and stage only the intended files. Do not
commit generated output, coverage, local credentials, or package archives.
Keep Superpowers planning documents local in the ignored `docs/superpowers/` directory.

Maintainers review and merge contributions before preparing a release.
