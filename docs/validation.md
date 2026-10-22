# Validation record

22 October 2026 · synthetic fixtures only

## 0.2.1 appearance coverage

**15 unit groups and 53 Chromium scenarios passed** on runtime commit `dda8e04d36826eaf145bc65c88ead79a8435458b`. [Passing run](https://github.com/librerob/draft-cairn/actions/runs/39868559743) · [machine-readable results](validation-results-0.2.1.json). Static, manifest, asset, palette contrast and reproducible package checks passed in the same run.

New checks exercise live system light/dark changes, persistent explicit overrides after reload, synchronization with the toolbar popup, dark dialogs, the on-page editor's appearance independently of the website, forced colors, reduced motion, and changes while the vault is locked. The existing 390px layout and full recovery/vault regression coverage remain. The encrypted export/import check covers an immediate import after download, including the dialog-close timing fix.

Both palettes pass 26 active text color pairs at 4.5:1 or greater, and six form-control boundary pairs at 3:1 or greater (`scripts/check-colors.py`). These numeric checks and automated media emulation are not a complete accessibility audit; native screen-reader, zoom and Windows High Contrast inspection remain manual. The actual UI screenshots use synthetic fixtures, local fonts, and disabled screenshot transitions for stable selected-navigation states.

## 0.2.0 vault/privacy coverage

**15 Node test groups and 48 Chromium scenarios passed** on runtime commit `383687cf7ab5d49e28fd438331032b8dfd9f83f7`. [Passing runtime run](https://github.com/librerob/draft-cairn/actions/runs/39849421888) · [machine-readable scenarios](validation-results-0.2.0.json). Browser: Chromium 151.0.7922.34 on Ubuntu 24.04. Static, manifest, assets and deterministic packaging checks passed in the same run.

The new scenarios exercise real UI vault setup and encrypted backup import/export, incorrect passwords, locked capture, explicit lock scrubbing, changed passphrases, worker termination/restart while unlocked, complete browser process restart, session-only draft loss with library persistence, return to automatic encryption, trusted field exclusion across reload, site blocking, both legacy migrations, and injected transaction abort during a near-capacity vault migration. A failed migration preserves the prior records, index and automatic key. A successful conversion fits more than 5 MiB of plaintext without Chrome storage.local duplication. Locked conversion to session-only storage evicts oldest revisions to meet its smaller budget. Delete all works without unlocking.

At 180 records and 5,533,199 plaintext bytes, the largest write for a new small draft was 84,653 bytes; observed end-to-end time was 420 ms including debounce and polling. This is one synthetic observation, not a performance guarantee. The operational index and answer records are encrypted separately. The index's automatic profile key is intentionally available while the answer vault is locked.

Unit coverage includes large hybrid-encrypted payloads, fresh IV/key wrapping, wrong passwords, authenticated-label mismatch, tampering, passphrase changes, encrypted export validation, bounded import KDF costs, privacy defaults and text-free revision planning. There is no independent cryptographic audit.

The test harness uses the shipped modules, with static test bindings and a localhost host pre-grant only in its temporary copy. It stores no real user data or browser traces. Permission prompts/revocation, daily-use OS clipboard, Windows/macOS native behavior, abrupt crashes and intended application portals remain manual gates. Documentation screenshots are synthetic fixtures from the actual UI. Earlier release results below are historical evidence.

## 0.1.2 review regression coverage

**10 Node rule-test groups and 32 Chromium scenarios passed** on runtime commit `e96ab132f1c77f40c4747d20d424ba122cbe3e55`. [Passing run](https://github.com/librerob/draft-cairn/actions/runs/39839798197) · [machine-readable results](validation-results-0.1.2.json). Static/syntax, manifest, asset checks, and deterministic packaging passed too.

Coverage adds quota exhaustion, synthetic-event rejection, unsupported-field status, inherited autocomplete=off, sticky failure badges, incremental encrypted writes near capacity, staged-write rollback, ciphertext integrity, local-key properties, legacy migration, full data/key deletion, and pending enable completion without a popup. With 180 records and 5,519,074 plaintext bytes, the largest write for a new small answer was 12,886 bytes; observed end-to-end time was 571 ms including the 250 ms debounce and polling. This one synthetic measurement is not a general performance guarantee.

The browser harness adds a loopback host pre-grant and a static test-only binding to the shipped storage module in its temporary copy. Native permission removal is simulated. Clipboard tests populate the browser clipboard through its API and use trusted keyboard paste; they no longer dispatch synthetic paste events for the positive path. Synthetic events are used to verify rejection. The shipping manifest and ZIP do not contain these harness changes.

The encryption/permission handoff is a material behavior change. Earlier 0.1.0/0.1.1 results below are historical evidence, not evidence for this implementation. Native prompt approval/denial/revocation, the daily-use OS clipboard, and two or three intended portals remain manual submission gates. See [review response](prepublication-review.md) and [smoke-test worksheet](store/manual-smoke-test.md).

## Historical 0.1.0 / 0.1.1 validation

Store-preparation patch 0.1.1 changes the 128px icon, version metadata, and packaging/docs only; recovery behavior and permissions are unchanged. The icon now uses Google's 96px artwork / 16px transparent-margin layout. `scripts/check-assets.py` checks all store PNG sizes and the icon alpha bounds. The full existing CI suite runs for this patch too. Native permission/clipboard manual checks below remain pending. The 0.1.0 validation record is preserved for provenance rather than relabelled as 0.1.1 evidence.

Verified on commit `370d004dddf9b170a06c1ab44ec26aac92cd1a43`: **8 unit groups and 20 Chromium integration scenarios passed**, including all retained draft IDs and library count surviving a real browser-process restart. Browser: Chromium 151.0.7922.34 on Ubuntu 24.04. [Validation run](https://github.com/librerob/draft-cairn/actions/runs/39828150956) and [gated release run](https://github.com/librerob/draft-cairn/actions/runs/39828270784) both succeeded. The [machine-readable result](validation-results.json) lists the exact scenarios and test-grant limitations.

The Windows and Linux release packages were compared byte for byte. SHA-256: `c84cd3c63a3c8e488c07d1018b2797066fe0d31237638d946ac54861faee6b3a`. The local demo's expiry/return flow was also manually verified in the in-app Chromium browser; this was a demo check, not a local extension installation test.

## Historical local checks

The original eight Node test groups passed: field exclusion, paste selection/UTF-16 arithmetic, conservative matching, revision/storage bounds, expiry, atomic import validation and hostile strings, and URL-origin handling. Static checks pass for JavaScript syntax, manifest permissions/incognito, runtime paths, safe text rendering, and absence of outbound request APIs. Reproducible packaging is checked by building twice and comparing SHA-256.

The Windows host has Chrome installed, but application-control policy blocked running the official downloaded Chrome for Testing binary. No policy was bypassed. Local real-extension browser integration and restart could not be verified here; GitHub Actions runs that suite on Linux Chromium instead.

## CI browser integration

`tests/browser.mjs` launches real Chromium with an isolated persistent profile, installs a temporary copy of the extension, and exercises the shipped JavaScript. Only the test manifest adds a loopback host pre-grant; the shipping manifest retains optional host access. The native Chrome permission prompt and permission removal are not automated. The test keeps its required loopback grant while exercising the independent exact-origin capture switch.

Scenarios cover capture disabled by default, typing and saving, reload and explicit restore, refusal to replace existing text, duplicate-field refusal, sensitive-field exclusions, selected-text oversized paste with complete original persistence, query/fragment omission and copy-only recovery, hostile library content rendered as text, atomic malformed import, injected storage failure and visible warning, expiry, deletion, process restart with persistent drafts/library, and a 390px workspace layout. Unit checks cover exact-fit and Unicode edge cases. The fixture session-expiry page is included for supervised testing.

The workflow uploads a compact result summary, synthetic screenshots, and the deterministic release ZIP. Read the repository Actions result for the exact commit; a green run is evidence for these scenarios, not for universal compatibility or production readiness.

## Manual checks still required

- The actual native optional host-permission prompt, denial, Chrome UI revocation, and the unmodified ZIP in a fresh daily-use Chrome profile.
- OS clipboard paste/copy behavior (automated integration uses trusted keyboard paste with a browser-populated clipboard), keyboard-only focus flow, screen-reader output, zoom/high contrast, and portal-specific interference.
- Hard crashes, abrupt device shutdown, true remote session expiry, framework-controlled forms, repeated client records at the same route, and compatibility on intended grant/application portals.
- Independent privacy/security review; Windows/macOS native runtime coverage.

No real client answers, captured browsing data, user profiles, credentials, or telemetry are used in tests or artifacts. Logs contain scenario names only; browser traces, page-content dumps, and answer-bearing error logs are intentionally absent.

## Release review focus

Review data loss (debounce, quota failure, revision history, editor edits, import atomicity), incorrect restoration (unique identity, structure, origin/path hash, empty destination, query/fragment refusal), permissions (optional hosts, origin validation, incognito exclusion), and exposure (sensitive hints, trusted-context storage, text sinks, no network calls, exports and clipboard warning). Material defects must be fixed before the initial release is published.
