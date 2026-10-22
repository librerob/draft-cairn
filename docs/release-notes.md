Draft Cairn 0.1.2 — recovery reliability and local storage fixes.

New saves evict the oldest recovery records when the 180-record or 6 MiB plaintext budget fills, with a visible eviction notice. Explicit library answers are never evicted; new library writes reserve room for recovery.

Capture ignores synthetic input/paste events. Status follows the focused field and warns when an editable field is unsupported. Ordinary autocomplete=off forms and narrative labels such as “payment schedule” are supported, while specific credential/payment hints remain excluded.

- Pending site choices survive popup closure; the worker completes them when access is granted and discards expired choices.
- Content-script registrations remain in place when host patterns match and update in place when they change.
- Persisted answers, metadata, and settings use AES-256-GCM with an automatic non-extractable key in extension-origin IndexedDB. Legacy plaintext migrates only after the encrypted commit succeeds. This is not a password-protected vault; profile/device control can still expose answers.
- Saves write changed encrypted records and a small encrypted index. Failed index commits preserve earlier data and remove staged records.
- Failure badges remain until acknowledged. Oversized captures have capture-specific error wording. Delete all removes encrypted records and the local key.

Validation includes Node/static checks, real Chromium integration, browser-process restart, failure injection, and deterministic packaging. Integration uses a temporary loopback host pre-grant and trusted keyboard paste with a browser-populated clipboard. See docs/validation.md for actual results and limitations. Native permission prompts/revocation, daily-use OS clipboard behavior, and two or three intended portals still require supervised synthetic-data checks.

Download and extract the extension ZIP, verify it against SHA256SUMS, and load the extracted folder via Chrome's Developer mode / Load unpacked. Full source and policies are in the repository.

Limits: standard top-level textareas and long ordinary text inputs only; no rich text, frames, incognito, or custom/server-side length detection. Latest unsaved keystrokes can be lost. Query/fragment pages remain copy-only because different applications may share a path and differ only by parameters the extension does not retain. Chrome grants host access across ports; capture separately checks the exact enabled origin. Keep a separate copy of important work.

This release has not been submitted to the Chrome Web Store. No paid service or fee has been activated.
