# Formal verification

Run these commands from the repository root. The checks run locally.

```sh
pnpm run formal:tla
pnpm run formal:lean
pnpm run formal
```

TLC needs Java and `tla2tools.jar`. Set `JAVA_HOME` if `java` on your PATH
points to a launcher without an installed JDK (the runner also checks Homebrew's
OpenJDK). The runner looks for the jar in `TLA2TOOLS_JAR`, the project and
Ensemble Scratch locations, and `~/.tla/tla2tools.jar`, in that order. Both
runners require `/Volumes/Scratch` to be mounted (unless `TLC_METADIR` is set
explicitly for TLC) so disposable state and Lake `.lake` build files never fall
back to Data storage. Lake uses the Lean 4.35.0 pin in `lean/lean-toolchain`
and the bundled standard library.

## TLA+ models

| Model and source | Safety and progress checked |
| --- | --- |
| [MockPool](tla/MockPool.tla) models `run`, `drain`, `complete`, `close`, `reset`, and their timer callbacks in [pool.ts](../src/lib/pool.ts). | Jobs remain accounted for through FIFO dispatch, slot reuse, bounded disconnect retries, close, and reset. The model checks capacity, the rate limit, closed-pool dispatch and clear, and isolation from stale job completions and timer callbacks. Submitted jobs settle and closed generations clear unless reset first. |
| [SendLifecycle](tla/SendLifecycle.tla) models invocation-time outcome reservation, compile and stream stages, and the `deliver` closure in [nodemailer-mock.ts](../src/nodemailer-mock.ts), plus `authorize` and `reset` in [oauth2.ts](../src/lib/oauth2.ts). | Reset fences sent mail, FIFO outcome consumption, token writes, and token events. Provisioning commits and renewals advance the version, fencing delayed writes. Renewal evicts the rejected cache entry, and a response check with a selected outcome preserves fail-once. Each delivery attempt has at most one renewal, and each started send settles. |

The checked configurations use two jobs or sends and two generations. The pool
has two logical connections, a rate limit of two, slot retirement after two
successes, and one retry per job. The send model has one OAuth user and
credential identity, up to two queued outcomes per generation, and one
delivery attempt per send. A separate pool redispatch can run another delivery
attempt. A renewal retry with an empty queue uses the ordinary fail-once
fallback.

Weak fairness gives pending callbacks, runnable delivery steps, and pool
timers a chance to advance. A user-supplied callback that never completes falls
outside that assumption. The pool models rate window boundaries and idle
timeouts as timer events. Both models include quiescent states and use TLC's
deadlock checking.

## Lean 4 proofs

| Module and source | Theorems |
| --- | --- |
| [AccessPolicy](lean/Formal/AccessPolicy.lean) follows `mergeAccessPolicy`, `assertContentAccess`, and `assertMessageAccess` in [access-policy.ts](../src/lib/access-policy.ts), plus top-level remote attachment preparation in [attachments.ts](../src/lib/attachments.ts). | The three-layer merge is associative, commutative, idempotent, and monotonic for each restriction. Preflight checks outer and nested references, including outer fallback sources with falsy content. A blocked file or URL causes rejection, with the first violation determining the message's error code. Data URI references pass either restriction. During rendering or validation, an attachment whose selected top-level reference is HTTP(S) is rejected under URL restrictions or substituted when remote attachments are disabled; ordinary non-rendering sends preserve unread URL-restricted attachments without fetching. |
| [PoolLimits](lean/Formal/PoolLimits.lean) follows option normalization, the rate timer calculation, `isIdle`, `drain`, and `complete` in [pool.ts](../src/lib/pool.ts). | Connection and message limits are positive for all modeled inputs. Timer delays fit the Node.js bounds even when the clock moves backwards. A closed pool is never idle, a stale completion preserves the pool state, and any sequence of dispatches and completions preserves the active connection bound. |
| [OAuthCache](lean/Formal/OAuthCache.lean) follows `hasFutureExpiry` and the cache and version logic of `authorize` in [oauth2.ts](../src/lib/oauth2.ts). | An explicit zero expiry is invalid at a nonnegative time, a cache hit has an expiry in the future, and a failed renewal leaves its evicted cache entry absent unless a separate write installs a token. A completion with a stale generation or user version can neither write nor emit. |
| [TestMessageUrl](lean/Formal/TestMessageUrl.lean) follows the trailing-bracket scan, base normalization, and message ID encoding in [test-account.ts](../src/lib/test-account.ts). | A successful scan yields a nonempty in-bounds span ending at the final bracket. The normalized base has no trailing slash. UTF-8 percent encoding emits no literal path, query, or fragment delimiters, and the checked segment excludes empty IDs and dot segments. |

Lean checks the model definitions for arbitrary lists, integers, and transition
sequences. The models use classified URLs, abstract provider results, and
Unicode scalar strings for UTF-8 encoding. JavaScript handles the original
inputs, including rejection when `encodeURIComponent` encounters an unpaired
surrogate. The checks establish properties of the models. The source links
identify the implementation paths each definition represents.
