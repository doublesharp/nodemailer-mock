# Changelog

Notable changes to `nodemailer-mock`, newest first. For contribution and release
steps, see [CONTRIBUTING.md](https://github.com/doublesharp/nodemailer-mock/blob/main/CONTRIBUTING.md) and the
[release runplan](https://github.com/doublesharp/nodemailer-mock/blob/main/docs/RELEASING.md).

Historical entries were reconstructed from commits and `package.json` version
changes on `main`. Dates are Git commit dates, not independently verified npm
publication dates. Heading links identify the source version commit; the entries
for 2.0.11 and 2.0.14 also include follow-up commits present in their release tags.

## Unreleased

## [2.1.0](https://github.com/doublesharp/nodemailer-mock/compare/v2.0.14...v2.1.0) - 2026-09-14

See the [upgrade notes](https://github.com/doublesharp/nodemailer-mock/blob/v2.1.0/docs/releases/2.1.0.md)
for TypeScript annotations and changes to mock behavior.

### Added

- Support Nodemailer 10 alongside versions 6–9, including CommonJS and ESM
  TypeScript consumers ([#30](https://github.com/doublesharp/nodemailer-mock/issues/30)).
- Export mock-specific result and plugin types, including `MockSentMessageInfo`,
  while accepting standard Nodemailer plugin and failure-check types.
- Add regression tests for transport defaults, plugin execution, injected
  transports, reset behavior, error handling, and TypeScript compatibility.
- Add this changelog, a contribution guide, and a release runplan.

### Fixed

- Correct README callback and Promise syntax and replace incomplete test examples
  with runnable cases.
- Allow `createTransport()` without options and accept SMTP URL options.
- Apply transport defaults while preserving per-message overrides; pass transport
  options, including access restrictions, to Nodemailer's mail implementation.
- Use the Nodemailer module supplied to `getMockFor()` when creating real
  transports and delegating verification or close calls.
- Keep mock plugin bookkeeping separate from Nodemailer's plugin registry so
  built-in compile plugins run correctly. Apply plugin enablement changes to
  already registered plugins.
- Restore mocked close behavior and cancel scheduled idle changes on reset.
- Report verification errors without a success value, and avoid invoking callbacks
  twice when user callbacks throw.
- Preserve errors thrown by failure checks; wrap other thrown values in an `Error`
  with the original value as its `cause`.
- Mock both Nodemailer 10 module entry points in the Node.js test runner example,
  with the appropriate mock options for Node.js 22 and 24.

### Changed

- Exclude development documentation and pnpm workspace configuration from the npm
  package, retaining the README, changelog, and license.
- Refresh dependencies and overrides to address reported security advisories.
- Run quality checks and all examples in the Node.js 22 and 24 CI matrix.
- Document mock result types, defaults, plugin controls, and reset behavior.

## [2.0.14](https://github.com/doublesharp/nodemailer-mock/commit/57865b2f00309214c19ce8a14d78c2a512a66b10) - 2026-08-13

- Update the development toolchain and CI to Node.js 22 and 24, including the Node.js test runner mock options.
- Update pnpm to 11.21.0 and run coverage generation with the locked `doublcov` dependency.
- Rename the default branch to `main` and refresh development dependencies.

## [2.0.13](https://github.com/doublesharp/nodemailer-mock/commit/16740d6b519b5648e0d8f4ea03e63cab7bdbe643) - 2026-06-18

- Resolve the pnpm version conflict in CI by using the version declared in `packageManager`.

## [2.0.12](https://github.com/doublesharp/nodemailer-mock/commit/8816f4d32a617a9e3b1f0af41204b716eb6e1181) - 2026-06-18

- Add Nodemailer 9 peer support and update the development dependency to Nodemailer 9.
- Update dependencies, including TypeScript 6 and Chai 6.

## [2.0.11](https://github.com/doublesharp/nodemailer-mock/commit/8cda8596ea9e8642da175782bc27d30438c149af) - 2026-04-28

- Migrate development and CI to pnpm; add Knip and quality-check scripts.
- Replace Mockery in examples with CommonJS cache-based mocks.
- Update dependencies and address reported transitive dependency advisories.
- Update GitHub Actions, publish coverage through GitHub Pages, and publish npm packages from version tags.

## [2.0.10](https://github.com/doublesharp/nodemailer-mock/commit/5ed427d9ddd85e32c64ced5c759e97c0a9d1c836) - 2026-03-30

- Add Nodemailer 8 peer support (#24).
- Add Node.js test runner and Vitest examples; update dependencies.

## [2.0.9](https://github.com/doublesharp/nodemailer-mock/commit/b249c435bfc9c819fc179002b62271dc63baf828) - 2025-05-31

- Add Nodemailer 7 peer support (#23).

## [2.0.8](https://github.com/doublesharp/nodemailer-mock/commit/8ac107718b1d932f96ef9dfa43e1fd6851c13583) - 2025-01-11

- Update dependencies, including `debug` 4.4 and Mocha 11, and refresh documentation.

## [2.0.7](https://github.com/doublesharp/nodemailer-mock/commit/ec367571abae26ad13fe0b5055a5f2a83d5cd920) - 2024-08-26

- Update dependencies, including `debug` 4.3.6, ESLint 9, and TypeScript 5.5.

## [2.0.6](https://github.com/doublesharp/nodemailer-mock/commit/d7bd3d585372e3dc35c318ecbc80ff2994221dab) - 2024-04-26

- Move `npm-check-updates` from runtime to development dependencies; refresh dependencies and the lockfile (#22).

## [2.0.5](https://github.com/doublesharp/nodemailer-mock/commit/ab3df8b8393f19f54a08dc33e75525031c4e69ba) - 2024-03-18

- Add an ESM wrapper and named exports, with module-loading tests and packaging cleanup.
- Update dependencies, including TypeScript 5.4.
- Remove source-line-count tooling.

## [2.0.4](https://github.com/doublesharp/nodemailer-mock/commit/ea97c7be09d40e04c9d2e9bb78576d70961ad9f2) - 2023-12-31

- Update TypeScript ESLint dependencies.

## [2.0.3](https://github.com/doublesharp/nodemailer-mock/commit/b5dd02aaa40a9e25ac6bd611c51df76d057d9c04) - 2023-12-20

- Update dependencies, including TypeScript 5.3, and add dependency-update tooling.

## [2.0.2](https://github.com/doublesharp/nodemailer-mock/commit/2dc312ffed8a58cfe1d39a7cd26f3ff005cce558) - 2023-10-24

- Update dependencies, including TypeScript 5.2 and Jest 29.7, and refresh documentation.

## [2.0.1](https://github.com/doublesharp/nodemailer-mock/commit/f7a90e5071cd80cbe697745b6266f9d093fc3c61) - 2023-01-26

- Correct packaging rules for compiled output and Yarn files.

## [2.0.0](https://github.com/doublesharp/nodemailer-mock/commit/fdb1fcb0a8e491ea452aed45756172cc309390b4) - 2023-01-26

- Rewrite the mock in TypeScript and publish type declarations.
- Build on Nodemailer mail and transport classes, with plugin controls, close-call tracking, and idle-state controls.
- Make Nodemailer 6 a peer dependency.

## [1.5.12](https://github.com/doublesharp/nodemailer-mock/commit/d0b8b9496177becc34c17d57bf47746f3142e049) - 2022-04-20

- Update dependencies, including `debug` 4.3.4 and ESLint 8.

## [1.5.11](https://github.com/doublesharp/nodemailer-mock/commit/f8ef5c5b7ea3ae6fb53659f6bf98d51f280e4d3a) - 2021-08-12

- Update development dependencies.

## [1.5.10](https://github.com/doublesharp/nodemailer-mock/commit/13365a506a87e08468121c60ba52fd7726ee3bf5) - 2021-07-10

- Update dependencies, including `debug` 4.3.2 and Mocha 9.

## [1.5.9](https://github.com/doublesharp/nodemailer-mock/commit/34801c0c1d46c3d32af6bacc652bd480a1b80bf1) - 2021-05-13

- Refactor legacy helper alias setup and update dependencies.

## [1.5.8](https://github.com/doublesharp/nodemailer-mock/commit/8274fd58d21a73189c8e95c8ee878614ecdeebd0) - 2021-04-02

- Remove Jest and Mockery from optional runtime dependencies.

## [1.5.7](https://github.com/doublesharp/nodemailer-mock/commit/871f60e5884e2d4d5ac1faf89af3602ead2dc63e) - 2021-04-02

- Add `getMockFor()` to create a mock for an injected Nodemailer module.

## [1.5.6](https://github.com/doublesharp/nodemailer-mock/commit/daa9621a826c0f004425eb5a37b800a79a8c0742) - 2021-04-02

- Correct documentation examples.

## [1.5.5](https://github.com/doublesharp/nodemailer-mock/commit/5ea8460742d1533fa8714675731c97e610c940f7) - 2021-04-02

- Add Jest and Mocha examples, handle an unavailable `createTransport`, and add GitHub Actions CI.

## [1.5.4](https://github.com/doublesharp/nodemailer-mock/commit/9a731fb15fc519e82fbe88486763ead7656d3fc1) - 2021-03-03

- Update `debug` and development dependencies.

## [1.5.3](https://github.com/doublesharp/nodemailer-mock/commit/8b55307bc518466b403b700e7ca417f8af056254) - 2020-08-13

- Update development dependencies.

## [1.5.2](https://github.com/doublesharp/nodemailer-mock/commit/d2bbdf6e2bc510d13a53a6b4a001ceb6afccb36d) - 2020-07-02

- Expose registered plugins through `transporter.mock.getPlugins()` and clear them on reset; update dependencies.

## [1.5.1](https://github.com/doublesharp/nodemailer-mock/commit/2340047678331390e0d3c45467b0cfe59e3030ae) - 2020-02-21

- Add `setShouldFailCheck()` for per-message failure decisions (#12).

## [1.5.0](https://github.com/doublesharp/nodemailer-mock/commit/d90abf27907bc40ae9c4e06afb759d1075a72279) - 2020-02-21

- Use an `Error` object as the default failure response; update tests and dependencies.

## [1.4.4](https://github.com/doublesharp/nodemailer-mock/commit/05ffbf7d59c68e3f146a0a9409d62ee73530b9ca) - 2019-10-22

- Update development dependencies.

## [1.4.3](https://github.com/doublesharp/nodemailer-mock/commit/52afd8c237cbcdd2d157472562bb1d8288b07888) - 2019-07-16

- Update development dependencies and NYC coverage tooling.

## [1.4.2](https://github.com/doublesharp/nodemailer-mock/commit/23a5321b6880717b61d3c0756535b439a217a142) - 2019-05-01

- Use the Nodemailer 6.x dependency range and update coverage tooling to NYC.

## [1.4.1](https://github.com/doublesharp/nodemailer-mock/commit/71a3104364ed4833760642a54c0dcb0eeb3244ee) - 2019-04-16

- Fix the legacy `shouldFailOnce` alias.

## [1.4.0](https://github.com/doublesharp/nodemailer-mock/commit/306440372d0450cf55e9724e4b79c9ab34fb8c59) - 2019-04-12

- Rename mock helpers to methods such as `setShouldFail()` and `getSentMail()`, retaining legacy aliases.
- Expand callback, Promise, and async/await tests.

## [1.3.18](https://github.com/doublesharp/nodemailer-mock/commit/367eaf54a0ca5304d231918d12cfac156608bf5a) - 2019-04-12

- Update dependencies to Nodemailer 6.

## [1.3.17](https://github.com/doublesharp/nodemailer-mock/commit/7ee53035206c901d7e5f10ae9c61146cff9d0378) - 2019-03-21

- Update dependencies and lint the code.

## [1.3.16](https://github.com/doublesharp/nodemailer-mock/commit/f6fe862890c2a8b4f149919f4cdc694ecd51e7cc) - 2019-02-28

- Add Promise support to mocked `verify()` (#8).

## [1.3.15](https://github.com/doublesharp/nodemailer-mock/commit/b5271bc6af8d53a9026165ed260a3725a27aff1a) - 2019-01-23

- Update dependencies to Nodemailer 5 and refresh tests.

## [1.3.14](https://github.com/doublesharp/nodemailer-mock/commit/08e6a4d8130a9ea709642144554d7ad6ee380846) - 2018-09-14

- Add plugin registration through `transporter.use()`; update dependencies.

## [1.3.13](https://github.com/doublesharp/nodemailer-mock/commit/ecf849e9e0c8fc27b8831d9607d9f8162bc810fe) - 2018-01-29

- Update dependencies and README.

## [1.3.12](https://github.com/doublesharp/nodemailer-mock/commit/00658875ad08589af4ee5549c3d80f5fccd345df) - 2017-12-16

- Update dependencies, including Nodemailer 4.4.1.

## [1.3.11](https://github.com/doublesharp/nodemailer-mock/commit/3a3a9288e093ebb96b41ffdc186544dd9e0f59ac) - 2017-11-21

- Pin dependency versions and update the lockfile.

## [1.3.10](https://github.com/doublesharp/nodemailer-mock/commit/cd4f059ebb81754bb0959aab086370342d1580db) - 2017-11-21

- Update dependencies, including Nodemailer 4.4.

## [1.3.9](https://github.com/doublesharp/nodemailer-mock/commit/76bb523ab89719f427d2a975a6e2d57a07d7c015) - 2017-11-02

- Update dependencies, including Nodemailer 4.3.1.

## [1.3.8](https://github.com/doublesharp/nodemailer-mock/commit/9fe8c8c53098a76b53f4e8a4c536a6d2e7f373f7) - 2017-10-14

- Update dependencies, including Nodemailer 4.2 and Mocha 4.

## [1.3.7](https://github.com/doublesharp/nodemailer-mock/commit/be2caec4a37deda386b8b269269408411d8f5888) - 2017-09-29

- Update dependencies, including Nodemailer 4.1.1.

## [1.3.6](https://github.com/doublesharp/nodemailer-mock/commit/2a6f1302d6d54665395a849f51969fcec5f7f2ba) - 2017-09-07

- Update dependencies, including Nodemailer 4.1.0.

## [1.3.5](https://github.com/doublesharp/nodemailer-mock/commit/53253e6f1980d4b82237bf068889a771aff012e8) - 2017-08-09

- Update dependencies, including `debug` 3.

## [1.3.4](https://github.com/doublesharp/nodemailer-mock/commit/6c71ee8c452b5fbc8f8122cdcdc00cb4a30d35cd) - 2017-08-04

- Update dependencies and README.

## [1.3.3](https://github.com/doublesharp/nodemailer-mock/commit/0b7bcc3968ddd9934c91687ebd3926e72cf942dc) - 2017-07-08

- Update lint dependencies.

## [1.3.2](https://github.com/doublesharp/nodemailer-mock/commit/9486712d1773f49369af3fe063b5cd2c9fd88861) - 2017-07-06

- Update README, coverage configuration, and development tooling.

## [1.3.1](https://github.com/doublesharp/nodemailer-mock/commit/8d77ed27b1a3e74cd8a83835d0d229210607fb9f) - 2017-06-10

- Update dependencies.

## [1.3.0](https://github.com/doublesharp/nodemailer-mock/commit/db03c8a3f328c63da718aa118c3c82f23bf5f4be) - 2017-05-06

- Add Promise support to `sendMail()` (#5).

## [1.2.2](https://github.com/doublesharp/nodemailer-mock/commit/99a0ea7df397345db97d233efe3780643db51726) - 2017-05-06

- Update dependencies, including Nodemailer 4.0.1.

## [1.2.1](https://github.com/doublesharp/nodemailer-mock/commit/5776ba1a736cd660c2adc881ed71e81119f03810) - 2017-03-11

- Restore missing development dependencies.

## [1.2.0](https://github.com/doublesharp/nodemailer-mock/commit/5c270188f75ed2aea7b5d156b85b7c95e54eecdb) - 2017-03-11

- Use a random string for `info.messageId`; update dependencies and ESLint configuration.

## [1.1.11](https://github.com/doublesharp/nodemailer-mock/commit/f58dddea1a5d038c8a2f78d889f678dff20fe469) - 2017-02-02

- Remove `developer-tools`, adopt Yarn, and update dependencies to Nodemailer 3.

## [1.1.10](https://github.com/doublesharp/nodemailer-mock/commit/3d13b80eb9ab4a9b4f0742ed74c0cbaf780188f0) - 2016-12-27

- Remove `developer-tools` from runtime dependencies again (#4).

## [1.1.9](https://github.com/doublesharp/nodemailer-mock/commit/30ee79c40d21cffb1a31ec1d7a320f06bb8a8ea7) - 2016-12-14

- Update dependencies, including Nodemailer 2.7.

## [1.1.8](https://github.com/doublesharp/nodemailer-mock/commit/56d9042df38e33cc69a0eb1698365e627359be26) - 2016-12-05

- Update dependencies and add source-line-count scripts.

## [1.1.7](https://github.com/doublesharp/nodemailer-mock/commit/f3c4c35ecbf14285647e671afa831ea4c1d2af47) - 2016-11-19

- Update and clean dependencies.

## [1.1.6](https://github.com/doublesharp/nodemailer-mock/commit/18455c253deba5052030bd5aa6d3bd551035c623) - 2016-11-08

- Update dependencies, including `debug` 2.3.

## [1.1.5](https://github.com/doublesharp/nodemailer-mock/commit/79b400e813ef3b85d8ba9baca953231ce122f7cd) - 2016-10-04

- Remove `developer-tools` from runtime dependencies (#2).

## [1.1.4](https://github.com/doublesharp/nodemailer-mock/commit/9233833695fa5cf1634baca2f12a86aeddc0b3eb) - 2016-09-26

- Update dependencies, including Nodemailer 2.6.4.

## [1.1.3](https://github.com/doublesharp/nodemailer-mock/commit/285f45b5439f001693773c0585187b873cde063c) - 2016-09-22

- Enable strict mode for Node.js 4 compatibility and rename the package entry file to `nodemailer-mock.js` (#1).

## [1.1.2](https://github.com/doublesharp/nodemailer-mock/commit/355437e5f76aab8571f20f835cc475c70586264a) - 2016-09-21

- Replace JSHint with ESLint and update development tooling.

## [1.1.1](https://github.com/doublesharp/nodemailer-mock/commit/727dfed495934ab2ccdbdbd682dc3091a8671166) - 2016-08-18

- Update examples, README, and package metadata.

## [1.1.0](https://github.com/doublesharp/nodemailer-mock/commit/10b15a92455526f54f6a7c3cfbed0d458b5280e6) - 2016-08-18

- Add mocked `transport.verify()` support and tests.

## [1.0.3](https://github.com/doublesharp/nodemailer-mock/commit/2aa74f0f2467d8b01dcb985354d6512b7173ba2f) - 2016-08-17

- Bump the package version; no additional functional change is recorded in this commit.

## [1.0.2](https://github.com/doublesharp/nodemailer-mock/commit/4c8a4d044bec6fba5b542af79787627d402aa678) - 2016-08-17

- Improve logging and formatting; add a coverage badge.

## [1.0.1](https://github.com/doublesharp/nodemailer-mock/commit/f3719f68c8ecbce28880e48b328a30b9047aa39a) - 2016-08-16

- Add configurable success responses and include the required `debug` dependency.

## [0.0.1](https://github.com/doublesharp/nodemailer-mock/commit/dfc454bf1765d70d8eb56ce81356f9687c1fb593) - 2016-08-16

- Initial Nodemailer mock with configurable send results and sent-mail inspection.
