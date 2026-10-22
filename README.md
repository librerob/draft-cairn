# Draft Cairn

Local answer recovery for long web applications. A free, MIT-licensed Chrome extension for grant writers, consultants, and agencies working through application portals.

Enable it for a website before writing. Supported fields save locally; the recovery workspace lets you review revisions, copy an answer, or explicitly restore it to a uniquely matched empty field. An answer library keeps reusable text you choose to save. Oversized pastes open a larger editor before HTML `maxlength` can truncate them.

This is an early preview. Commercial demand and broad compatibility have not been established. Keep a separate copy of important work.

## Install

1. Download `draft-cairn-0.1.0.zip` from [Releases](https://github.com/librerob/draft-cairn/releases), verify it against `SHA256SUMS`, and extract it.
2. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
3. Pin Draft Cairn. On an ordinary HTTP/HTTPS website, open its popup and choose **Enable for this site**. Approve Chrome's site-access request.
4. Type in a supported field and wait for **saved on this device**. Open **Recovery & library** to inspect saved text.

For a source checkout, load the `extension/` folder directly. Chrome 120 or later is required. This release is not on the Chrome Web Store; no store submission or payment has been made.

## What it saves

- Visible, editable standard textareas, and ordinary text inputs with a declared `maxlength` of at least 120.
- Up to four snapshots per field. Rapid edits update the current snapshot; revisions at least 30 seconds apart can remain as earlier snapshots.
- Seven days of recovery by default, configurable to 1, 3, 7, 14, or 30 days. Complete oversized pastes expire within one hour. Expiry cleanup runs hourly while Chrome is running and on reads/startup.
- Library answers with a title and optional project. These remain until deleted; import/export uses a [documented v1 format](docs/library-format.md).

The current release supports only the top-level page. Rich text editors, contenteditable, frames, browser-internal pages, and incognito are excluded. See [compatibility](docs/compatibility.md).

## Privacy and control

No analytics, accounts, advertising, remote AI, or answer transmission. Storage is in this browser profile, not synchronized. No URL query strings, fragments, or raw paths are stored. Page titles and field labels are retained so you can recognize answers; these can themselves contain sensitive information.

Password, payment, one-time-code, hidden, disabled, read-only, and sensitive-hint fields are excluded. Autocomplete values other than `on` are excluded, including `off`. Filtering cannot identify every confidential answer. Browser-local storage is **not an encrypted vault**. Read the [privacy policy](PRIVACY.md) and [security policy](SECURITY.md) before using client information.

Delete one revision, a site's drafts and access, or all extension data in the workspace. Manually saved library answers have no site association; delete them separately or use Delete all. Exports and clipboard contents remain outside the extension.

## Development and demo

Requires Node.js 24 and Python 3. No runtime dependencies or build step.

```sh
npm ci --ignore-scripts
npm test
npm run check
npm run demo
```

Open `http://127.0.0.1:8765/index.html`, enable protection, and use synthetic answers. The demo intentionally loses text on reload and has a **Simulate session expiry** button. Test the two identically labelled fields, excluded inputs, selection-aware oversized pastes, and emoji.

```sh
npx playwright install --with-deps chromium
npm run test:browser
python3 scripts/package.py
```

On Windows use `python` instead of `python3`. Browser tests use an isolated temporary profile and a test-only localhost host pre-grant. They exercise the shipped JavaScript; they do not automate Chrome's native permission dialog. Set `CHROMIUM_PATH` to a Chrome for Testing executable if necessary. [Validation notes](docs/validation.md) separate local, CI, and unverified checks.

The package script uses an exact file allowlist, fixed metadata, and uncompressed ZIP entries for reproducible bytes. The extension ZIP contains only the 14 runtime files; source, demo, tests, and policies remain in this repository. Icon generation is reproducible with `python3 scripts/icons.py`.

## Design and release notes

Plain JavaScript, HTML, and CSS keep review and maintenance straightforward. The service worker validates messages, serializes storage changes, limits size, and restricts direct storage access to trusted extension pages. Content scripts only receive their own save responses and explicitly requested restores. User text is rendered with `textContent` or `value`.

Restoration uses a hashed page path, a stable field descriptor, and the ordered form structure. Duplicate or missing identities refuse restoration. Pages with query strings or fragments support copying only. This conservatism reduces wrong-field restoration; it cannot prove that a website has kept the same meaning for an identifier. Always check restored text before submitting.

- [Commercial validation](docs/commercial-validation.md) — first users, alternatives, and decision criteria.
- [Costs](docs/costs.md) — current requirements, no recurring infrastructure, future cost categories.
- [Store listing and submission checklist](docs/chrome-web-store.md).
- [Release notes](docs/release-notes.md).

No paid services or paywalls are included. No verified sponsorship destination was available, so no sponsorship link is included.
