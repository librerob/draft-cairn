Draft Cairn 0.1.1 — store preparation patch to the free, MIT-licensed local recovery preview.

This patch corrects the 128px store icon to a 96px mark with 16px transparent margins, adds editable brand sources and a 512px preview, and provides a separate store-upload kit with screenshots, promotional tile, listing copy, reviewer steps, privacy policy, and submission checklist. Recovery behavior and permissions are unchanged from 0.1.0.

The kit is ready to prepare a listing. Final tests of the unmodified extension's native Chrome permission prompt/revocation and actual OS clipboard interaction are still required before submission. No store upload or submission has been performed.

- Explicit website protection with optional host access.
- Bounded local revisions, seven-day default retention, preview/copy, and explicit restore to confidently matched empty fields.
- Declared `maxlength` paste warnings, complete temporary original-paste recovery, and a larger editor.
- Project-grouped answer library with search, copying, versioned import/export, and deletion controls.
- No accounts, analytics, remote AI, paid features, or recurring application infrastructure.

Validation includes Node/static checks, real Chromium integration on GitHub Actions, browser-process restart persistence, failure injection, and deterministic packaging. Browser integration uses a temporary localhost host pre-grant; native permission prompts/removal and actual OS clipboard interaction still need manual verification. Windows policy blocked local downloaded Chromium execution. See `docs/validation.md` for the exact scope and remaining checks.

Download and extract the extension ZIP, verify it against SHA256SUMS, and load the extracted folder via Chrome's Developer mode / Load unpacked. Full source and policies are in the repository.

Limits: standard top-level textareas and long ordinary text inputs only; no rich text, frames, incognito, or custom/server-side length detection. Latest unsaved keystrokes can be lost. Ambiguous, nonempty, and query-based destinations require copying. Browser-local storage is not an encrypted vault. Keep a separate copy of important work.

This release has not been submitted to the Chrome Web Store. No paid service or fee has been activated.
