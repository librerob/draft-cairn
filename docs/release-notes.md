Draft Cairn 0.2.0 preview — optional passphrase vault and privacy controls.

Automatic encryption remains the password-free default. Users can opt into a passphrase vault: new drafts continue saving while locked, and reading, search, restoration and library changes require unlocking. A forgotten passphrase cannot be reset. Changing the passphrase or returning to automatic encryption preserves existing answers through atomic rekeying.

- The vault uses per-record AES-256-GCM with RSA-OAEP-3072 key wrapping. PBKDF2-SHA-256 protects the private key. Unlock survives worker suspension and clears on explicit lock or browser/extension session end.
- The operational index uses a separate automatic key in the profile. The vault protects answer contents in copied files; it does not hide operational metadata from a profile holder or protect an actively compromised browser/device. See PRIVACY.md.
- Fresh installations default to one-day recovery without page titles/field details. Existing choices are preserved. Minimal-metadata drafts are copy-only; enabling page details permits conservative direct restoration.
- Optional session-only recovery keeps encrypted drafts in browser-session memory, with a smaller 2 MiB recovery budget. The persistent library remains. Chrome must fully exit to end its session; closing the last window can leave background Chrome running.
- Block sites from the popup or exclude fields in the larger on-page editor. Manage exclusions in settings. Field exclusion deletes its recovery revisions; blocking a site keeps earlier drafts unless deleted.
- Export a passphrase-encrypted library backup or explicitly choose readable JSON. Backup passwords are separate from the vault. Clipboard managers/history and exported copies remain outside lock and wipe controls.
- Delete all is also available in the popup, including while locked. Persistent record/index/key updates are atomic. Migration supports old plaintext and v0.1.2 encrypted stores without duplicating a full dataset inside Chrome storage.local's quota.

Validation: 15 unit groups, 48 real Chromium integration scenarios, static/manifest/assets checks and reproducible packaging passed. Tests cover locked capture, real worker/browser restart, UI scrubbing, wrong passwords, exports, exclusions, legacy upgrades and failed near-capacity migration rollback. See docs/validation.md and validation-results-0.2.0.json for evidence and limits. There has been no independent cryptographic/security audit.

Native Chrome permission approval/denial/revocation, daily-use OS clipboard behavior and two or three intended portals still need supervised synthetic-data checks before store submission. Automated integration pre-grants localhost in a temporary test copy. The shipping manifest keeps all hosts optional.

Extract the extension ZIP, verify SHA256SUMS, and load its manifest folder using chrome://extensions → Developer mode → Load unpacked. The separate store kit contains the install ZIP, icon, images, listing copy and reviewer steps. Upload only the inner extension ZIP as the package.

Limits: standard top-level textareas and long ordinary text inputs; no rich text, frames or incognito. Unsupported fields visibly warn. Latest unsaved keystrokes may be lost. Direct restoration is empty-field-only, unique-match-only, and unavailable for query/fragment pages or drafts without field details. Keep a separate copy of important work.

This release has not been submitted to the Chrome Web Store. No paid service, registration or fee has been activated.
