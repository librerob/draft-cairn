# Pre-publication review response

22 October 2026 · 0.1.2 · synthetic tests only

The supplied code review correctly identified reliability and status problems. Earlier checks did not cover count-cap exhaustion, focused-field status, or synthetic-event flooding. The regression suite now targets those failures.

| Finding | Response |
| --- | --- |
| Draft count / byte cap blocks recovery | Evict oldest recovery records first; preserve the newest save and explicit library answers. Report eviction. New library writes reserve 700 KiB for recovery. An older library already filling capacity may require export/deletion; it is never silently erased. |
| Synthetic input/paste fills storage | Both handlers require isTrusted. A hostile website can still manipulate its own fields during actual user interaction. |
| Protection pill misleads | Neutral initial prompt; supported-field saving/saved status; unsupported editable focus warns. Async save completion does not override another field's warning or mark newer text as saved. |
| Branded DOM marker | Removed data-cairn-ui. Visible page UI remains detectable; no stealth claim. |
| autocomplete=off exclusion | Allow ordinary off/on; exclude sensitive tokens, including grouped section/billing hints. |
| Narrative filter too broad | Token boundaries and camel-case splitting; stricter identifier hints; specific sensitive phrases in labels. Review examples have unit regressions. |
| Query-based restore unavailable | Retained deliberately: different applications can share a path and differ only by query. Copy remains available without retaining query values. |
| Permission popup closes | Persist a short-lived explicit choice in trusted session memory. The worker handles permission-added and pending-choice changes, covering either ordering. A surviving popup also completes the request. Native-prompt behavior still needs a manual check. |
| Hourly registration gap | Compare pattern sets, leave unchanged scripts registered, update changes in place. |
| Grants cover all ports | Explain this before enabling; continue exact-origin checks on every capture. |
| Whole dataset rewritten | Immutable cached records, cached byte sizes, incremental encrypted records and a small encrypted index. Test a trusted edit after seeding 180 records near capacity. |
| Wrong oversized-capture wording | Capture-specific 100,000-unit limit error. |
| Unrelated success hides a failure | Session-persistent warning and badge until explicit acknowledgement. |
| activeTab appears redundant | Keep it: the popup needs the selected tab URL before optional host access. |

## Encryption boundary

Each persisted record and the index use AES-256-GCM, fresh random 96-bit IVs, and the storage key name as authenticated additional data. The key is generated non-extractable and persisted as a CryptoKey in extension-origin IndexedDB. Production state writes are serialized by the worker; storage.local and session access are restricted to trusted extension contexts. Changed records are staged before publishing the index. Failed index writes preserve the previous index and remove staged records.

This is automatic local encryption, not independent protection against a stolen profile, malicious extension, compromised browser/device, or someone using the unlocked extension. There is no password recovery or remote key copy. Lost keys and authentication failures preserve ciphertext and fail closed. Migration/deletion cannot erase old sectors or backups. User-directed JSON exports and the clipboard remain plaintext.

## Remaining submission checks

Use the unmodified packaged ZIP in a fresh Chrome profile: native permission denial/approval with popup closure, Chrome UI revocation, ordinary OS clipboard use, keyboard/screen-reader behavior, and two or three intended portals using authorized synthetic data. Record supported and unsupported fields. No real client answers belong in public issues or artifacts. See store/manual-smoke-test.md.
