# Validation record

22 October 2026 · synthetic fixtures only

## Local checks

Eight Node test groups pass: field exclusion, paste selection/UTF-16 arithmetic, conservative matching, revision/storage bounds, expiry, atomic import validation and hostile strings, and URL-origin handling. Static checks pass for JavaScript syntax, manifest permissions/incognito, runtime paths, safe text rendering, and absence of outbound request APIs. Reproducible packaging is checked by building twice and comparing SHA-256.

The Windows host has Chrome installed, but application-control policy blocked running the official downloaded Chrome for Testing binary. No policy was bypassed. Local real-extension browser integration and restart could not be verified here; GitHub Actions runs that suite on Linux Chromium instead.

## CI browser integration

`tests/browser.mjs` launches real Chromium with an isolated persistent profile, installs a temporary copy of the extension, and exercises the shipped JavaScript. Only the test manifest adds a loopback host pre-grant; the shipping manifest retains optional host access. The native Chrome permission prompt and permission removal are not automated. The test keeps its required loopback grant while exercising the independent exact-origin capture switch.

Scenarios cover capture disabled by default, typing and saving, reload and explicit restore, refusal to replace existing text, duplicate-field refusal, sensitive-field exclusions, selected-text oversized paste with complete original persistence, query/fragment omission and copy-only recovery, hostile library content rendered as text, atomic malformed import, injected storage failure and visible warning, expiry, deletion, process restart with persistent drafts/library, and a 390px workspace layout. Unit checks cover exact-fit and Unicode edge cases. The fixture session-expiry page is included for supervised testing.

The workflow uploads a compact result summary, synthetic screenshots, and the deterministic release ZIP. Read the repository Actions result for the exact commit; a green run is evidence for these scenarios, not for universal compatibility or production readiness.

## Manual checks still required

- The actual native optional host-permission prompt, denial, Chrome UI revocation, and the unmodified ZIP in a fresh daily-use Chrome profile.
- OS clipboard paste/copy behavior (automated integration dispatches synthetic clipboard events), keyboard-only focus flow, screen-reader output, zoom/high contrast, and portal-specific interference.
- Hard crashes, abrupt device shutdown, true remote session expiry, framework-controlled forms, repeated client records at the same route, and compatibility on intended grant/application portals.
- Independent privacy/security review; Windows/macOS native runtime coverage.

No real client answers, captured browsing data, user profiles, credentials, or telemetry are used in tests or artifacts. Logs contain scenario names only; browser traces, page-content dumps, and answer-bearing error logs are intentionally absent.

## Release review focus

Review data loss (debounce, quota failure, revision history, editor edits, import atomicity), incorrect restoration (unique identity, structure, origin/path hash, empty destination, query/fragment refusal), permissions (optional hosts, origin validation, incognito exclusion), and exposure (sensitive hints, trusted-context storage, text sinks, no network calls, exports and clipboard warning). Material defects must be fixed before the initial release is published.
