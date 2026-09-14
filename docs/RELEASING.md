# Contribution and release runplan

Use this checklist to prepare, review, publish, and verify a stable release.
Start with [CONTRIBUTING.md](../CONTRIBUTING.md) for implementation and testing.

The current [publish workflow](../.github/workflows/publish.yml) publishes to npm
when a tag matching `v*` is pushed. It checks that the tag matches `package.json`,
installs the frozen pnpm lockfile on Node.js 24, runs `quality` and `nyc`, and runs
`npm publish --access public`. It does not run the examples or create a GitHub
Release. Pushing the version tag is the publication step.

## 1. Scope the release

- [ ] Review merged changes and open issues for the intended release. Compare with
  the previous release commit or tag using `git log` and `git diff`.
- [ ] Confirm the target branch is `main`, inspect `git status`, and preserve
  unrelated work. Prepare release changes on a `feature/` branch.
- [ ] Choose the next version using the highest-impact change:

| Bump | Use for |
| --- | --- |
| Patch (`X.Y.Z+1`) | Compatible bug fixes, documentation corrections, and dependency maintenance that preserves public behavior and requirements |
| Minor (`X.Y+1.0`) | Backward-compatible new APIs or capabilities, including support for a new Nodemailer major when existing supported usage remains compatible |
| Major (`X+1.0.0`) | Removed APIs, incompatible behavior or public types, dropped supported Nodemailer majors, or raised consumer runtime requirements |

Review compatibility rather than copying the size of an upstream version bump.
Include migration instructions for breaking changes. A docs-only change can wait
for the next code release if no package publication is needed.

**Prereleases:** the existing workflow publishes to the default `latest` dist-tag,
even for a tag such as `v3.0.0-rc.1`. Before publishing a prerelease, change and
review the workflow to use an explicit non-stable npm dist-tag (for example,
`next`). Do not push a prerelease version tag using the current workflow.

## 2. Complete code, tests, and documentation

- [ ] Fix the intended issues and add regression tests; review correctness,
  performance, reset/lifecycle behavior, and error propagation.
- [ ] Update `README.md`: supported versions, installation, public API signatures,
  defaults, error behavior, and examples must describe the code being released.
  Compare compatibility claims with `peerDependencies` and the CI matrix; review
  version-dependent test-runner snippets when changing supported runtimes.
- [ ] Update affected `docs/` pages, this runplan, and `CONTRIBUTING.md` when the
  process or commands change. Keep runnable examples and README snippets aligned.
- [ ] Reconcile every user-visible change with `CHANGELOG.md`'s `Unreleased`
  section. Remove duplicate or speculative entries. Include security fixes and
  migration notes where applicable.
- [ ] Review dependency ranges and resolved versions. Keep `package.json`,
  `pnpm-lock.yaml`, and `pnpm-workspace.yaml` consistent. Do not bypass release-age
  or build-script policies to obtain a newer dependency.

## 3. Bump the package version

In the release branch, run exactly one bump command. This example selects a patch;
replace `patch` with `minor`, `major`, or the agreed exact version:

```sh
npm version patch --no-git-tag-version --ignore-scripts
pnpm install --lockfile-only --ignore-scripts
git diff -- package.json pnpm-lock.yaml
```

`npm version` here only edits version metadata; it does not create a commit or tag
and does not run lifecycle scripts. Continue using pnpm to install dependencies.
The root package version may not change the pnpm lockfile; do not manufacture a
lockfile diff or create a `package-lock.json`.

- [ ] Confirm `package.json` contains the intended version and that version is not
  already published on npm or used by a remote tag.
- [ ] Move the completed `Unreleased` notes into `## X.Y.Z - YYYY-MM-DD`, using the
  intended release date, and add a fresh `## Unreleased` section above it. If the
  release is delayed, correct the date before tagging.
- [ ] Link the new heading to the planned `vX.Y.Z` tag or comparison. Keep historical
  commit links intact: most older versions do not have release tags.
- [ ] Update any version-specific README or docs examples and migration guidance.
  Do not replace unrelated historical versions throughout the repository.

## 4. Run release checks

Use the pnpm version declared in `packageManager`. Run the following on both Node.js
22 and 24, using the final release source and lockfile:

```sh
pnpm install --frozen-lockfile
pnpm run quality
pnpm run nyc
pnpm run examples
pnpm audit
git diff --check
```

- [ ] All checks pass; investigate any audit warnings and record unresolved risks
  for maintainer review before proceeding.
- [ ] For transport, module-loading, type, or peer-range changes, test every
  supported Nodemailer major (currently 6–10) on both Node.js versions. Use isolated
  temporary checkouts or consumers with exact tested dependency versions, leaving
  the release lockfile unchanged. Run regression tests and CommonJS/ESM TypeScript
  fixtures as well as a basic send. Record exact Node.js and Nodemailer versions.
- [ ] Review test and coverage results, the complete release diff, and the rendered
  Markdown. Verify documentation links and commands against the final tree.

The CI matrix currently covers Node.js 22 and 24 with the single locked Nodemailer
development version. It is not a Nodemailer-major compatibility matrix.

## 5. Inspect and smoke-test the package

After the build and tests pass, create an archive outside the checkout:

```sh
release_version=$(node -p "require('./package.json').version")
release_nodemailer_version=$(node -p "require('nodemailer/package.json').version")
release_pack_dir=$(mktemp -d)
pnpm pack --pack-destination "$release_pack_dir"
release_archive="$release_pack_dir/nodemailer-mock-$release_version.tgz"
tar -tzf "$release_archive"
```

- [ ] Confirm the archive contains `package.json`, `README.md`, `CHANGELOG.md`,
  `LICENSE`, compiled JavaScript, the ESM wrapper, and TypeScript declarations.
- [ ] Check `main`, `module`, `types`, and `exports` in the packaged `package.json`
  all point to included files. Source, tests, coverage, `docs/`, `CONTRIBUTING.md`,
  and pnpm lockfile/workspace configuration should be excluded by `.npmignore`.

In the same shell, test the archive from a fresh consumer directory. This uses the
exact Nodemailer version installed in the release checkout and sends only through
the mock:

```sh
release_consumer_dir=$(mktemp -d)
(
  cd "$release_consumer_dir" || exit 1
  npm init -y >/dev/null
  npm install --ignore-scripts --no-audit --no-fund \
    --cache "$release_consumer_dir/.npm-cache" \
    "$release_archive" "nodemailer@$release_nodemailer_version" || exit 1
  node <<'NODE'
const assert = require('node:assert/strict');
async function check() {
  const cjs = require('nodemailer-mock');
  const esm = await import('nodemailer-mock');
  assert.equal(typeof esm.createTransport, 'function');
  for (const mock of [cjs, esm.default]) {
    mock.mock.reset();
    const info = await mock.createTransport().sendMail({
      from: 'sender@example.test',
      to: 'recipient@example.test',
      subject: 'Package smoke test',
      text: 'No real email is sent.',
    });
    assert.equal(typeof info.messageId, 'string');
    assert.equal(mock.mock.getSentMail().length, 1);
    mock.mock.reset();
  }
}
check().catch((error) => { console.error(error); process.exitCode = 1; });
NODE
)
```

- [ ] The smoke test passes without relying on repository source or build tools.
  This is an additional packaging check, not a substitute for regression/type
  tests across supported Nodemailer versions.
- [ ] Save the tested commit, command results, exact version matrix, and archive
  checksum (`shasum -a 256 "$release_archive"`) in the release PR or release record.
  The publish workflow builds its own archive from the tagged commit.

## 6. Review and merge

- [ ] Submit the release PR with the selected version, user-visible changes,
  migration notes, dependency/security status, and verification evidence.
- [ ] Ensure the PR includes the version bump, changelog, README/docs changes, and
  any relevant lockfile changes. Stage only intended files; exclude archives and
  generated output.
- [ ] Obtain maintainer review, resolve findings, and merge to `main` with passing
  required checks. If the source or lockfile changes after testing, repeat the
  affected checks on the final source.
- [ ] Confirm the exact commit to tag contains the reviewed release and has passed
  CI. If a docs-only change did not trigger CI, run the workflow manually or record
  equivalent final-commit checks before publishing.

## 7. Publish the stable release

Only a maintainer intending to publish should perform this step. Confirm npm
publishing access and the trusted-publisher configuration for this repository and
`publish.yml`. The workflow requests OIDC permission; the repository file alone
does not prove the npm-side configuration is correct.

From a clean checkout of the reviewed release commit on `main`:

```sh
git fetch origin --tags
git switch main
git pull --ff-only origin main
git status --short
git log -1 --oneline
release_version=$(node -p "require('./package.json').version")
git ls-remote --tags origin "refs/tags/v$release_version"
npm view "nodemailer-mock@$release_version" version
```

Stop if the checkout is dirty, `HEAD` differs from the reviewed commit, the tag
already exists, or npm returns that version. An npm registry “version not found”
response is expected for a new version; a network or authentication failure is not
proof that the version is unused. Verify the changelog version and date once more.

Create the annotated tag on that verified commit, then push only that tag:

```sh
git tag -a "v$release_version" -m "Release $release_version"
git show --no-patch "v$release_version"
git push origin "refs/tags/v$release_version"
```

The push starts npm publication. Do not run a second manual `npm publish` in
parallel, push all local tags, or move an existing published tag.

## 8. Verify and announce

- [ ] Confirm the **Publish to npm** workflow succeeded for the intended tag and
  commit, including its tag/version check and publish step.
- [ ] Check the registry version, dist-tag, and artifact metadata:

```sh
npm view "nodemailer-mock@$release_version" version dist.integrity dist.tarball
npm view nodemailer-mock dist-tags --json
```

- [ ] Confirm `latest` is the intended stable release. Install the exact published
  version in a fresh temporary consumer and repeat the CommonJS/ESM smoke test from
  step 5, replacing the archive argument with `nodemailer-mock@$release_version`.
- [ ] Check the npm README and package files, then create a GitHub Release for the
  existing tag using the matching changelog entry and migration notes.
- [ ] Link the release from resolved issues as appropriate and confirm `main`
  retains an empty `Unreleased` section for future contributions.

## If publication fails or a released bug is found

Read the failed workflow step and check npm before retrying: a failed job can occur
after an upload succeeds. If the version is absent and the failure was transient,
rerun the workflow for the same tag and commit. If fixing it changes the release
source, prepare a new version and tag through this checklist; do not move the old
tag or try to overwrite an existing npm version.

For a published bug, add a regression test, fix it, document the impact, and release
a new patch (or the appropriate larger bump for an incompatible fix). A maintainer
may separately deprecate a broken version or move a dist-tag after assessing users'
needs. Record that decision; deleting a GitHub tag does not undo npm publication.
