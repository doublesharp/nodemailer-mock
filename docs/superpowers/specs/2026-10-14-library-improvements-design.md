# Library improvements approved for delivery

The user approved items 1–6 of the library review with “ship 1-6 with subagents”. Implement the approved improvements in a backward-compatible minor release. Preserve legacy mock results, all documented import styles, callback/Promise support, Nodemailer 6–10, and lightweight reset semantics. New behavior must be explicit where it changes existing output.

## Runtime behavior

Allocate a fresh default Error for each mock and reset. Retain custom Error identity until reset. An old send completing after reset must settle normally for its caller but cannot add mail to the new history. This fence must cover user compile/stream plugins as well as the transport completion microtask. Existing reset retains transporters and plugins as documented. Add an explicit full-reset option that clears the registry and removes retained listeners, without turning mock cleanup into real verification or delivery.

Offer realistic results through an optional factory configuration. Preserve the existing MockSentMessageInfo interface and default return types. Add a distinct realistic result type whose envelope is {from: string, to: string[]}, whose accepted recipients derive from the compiled envelope, and whose messageId honors the compiled mail's message ID. Permit a deterministic ID generator and typed configured/queued results. Queue outcomes in invocation order; verification must not consume send outcomes. Reset clears queued/configured overrides and transient ID settings while preserving factory response mode. Document precedence and reset behavior. No latency simulator or real network delivery is needed.

## Type and package compatibility

Accept custom transports independently of their own result type, retaining the mock's result type. Export a real ESM wrapper with a default export and accurate declarations, preserve the shared singleton, and test package-name imports. Keep CommonJS behavior stable. Automate packaged runtime and consumer type fixtures against exact eligible versions of Nodemailer 6, 7, 8, 9, and 10 on Node 22 and 24. Test runtime/plugin/default/error behavior, not only import success. Do not rewrite the release lockfile for the compatibility matrix.

## Delivery and evidence

Use isolated worktrees and three implementation subagents. Write regression tests before production changes, retain red/green evidence in task reports, review each task, and review the integrated branch. Update README, contributor/release documentation, and changelog with shipped APIs and behavior. Run quality, coverage, examples, and packaged compatibility tests on the final tree. Inspect the archive. Prepare the version and release record only after final integration validation. Keep source integration, CI, and npm publication evidence separate.
