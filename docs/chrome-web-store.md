# Chrome Web Store preparation

Checked 22 October 2026. No upload, payment, registration, or store submission has been performed.

## Readiness

The **0.2.0 preparation kit contains every mandatory image asset**, the install ZIP, listing copy, privacy policy, and reviewer instructions. The 0.2.0 runtime adds an optional passphrase vault and privacy controls, while retaining fixes for quota eviction, trusted events, focused-field status, narrower filters, durable permission handoff, incremental encrypted storage, and persistent failure warnings. The store icon has a 96×96 design inside its 128×128 PNG with 16px transparent margins. The promotional tile is 440×280; both real-interface screenshots are 1280×800. Dimensions and margins are checked by `scripts/check-assets.py` against the current official image guide.

**Submission remains pending final manual checks:** load the unmodified ZIP in a fresh Chrome profile, test the real optional host-permission approval/denial/revocation, actual OS clipboard paste/copy, and an intended application portal with synthetic data. The [manual smoke-test worksheet](store/manual-smoke-test.md) gives the exact steps. Browser CI pre-grants localhost access, so it does not verify those native flows. The owner's developer account, verification, and distribution settings must also be completed in the dashboard.

Download `draft-cairn-store-kit-0.2.0.zip` from GitHub Releases and extract it. **Only upload the inner `extension/draft-cairn-0.2.0.zip` as the package.** The outer kit is a preparation folder, not an installable extension. Upload the files under `listing/` separately into their respective image/text fields. Editable brand sources stay in `docs/store/` in the source repository.

## Draft listing

**Name:** Draft Cairn

**Short description:** Local answer recovery, paste-limit warnings, and a reusable answer library for websites you choose.

**Detailed description:**

Long applications take concentration. Draft Cairn keeps local recovery copies of supported long-answer fields on the websites you explicitly enable.

Imagine this:

1. You're filling in a website's big answer box, perhaps describing a project in a grant application.
2. You spend half an hour writing.
3. The website reloads or logs you out. Your answer disappears.
4. If Draft Cairn was enabled beforehand and finished saving, you open its recovery workspace and copy your saved answer back.

Enable protection before you start and wait for **saved on this device**. Text that has not finished saving may still be lost. Draft Cairn cannot keep you logged in or recover earlier unprotected text.

Review saved revisions by site and saved time. Page titles and field details are optional; without them, recovery is copy-only. Copy an answer, or explicitly restore it to an empty field when the match is clear. Nothing is restored or submitted automatically.

Before a paste exceeds an HTML field's declared character limit, Draft Cairn stops the paste and opens a larger editor with the complete original and a counter. It does not detect every custom website limit and never rewrites or shortens your answer.

Keep reusable answers in a simple library with titles, projects, search, copying, and JSON export/import. All implemented local features are free.

No account, analytics, ads, remote AI, or answer transmission. Answers stay in this browser profile. New installations default to one day of recovery (existing choices are preserved), with oldest-first eviction if the recovery budget fills; temporary original pastes last up to one hour. Library answers stay until deleted. Answer records are encrypted automatically with a key in the same profile. An optional passphrase vault protects answer contents in copied profile files and keeps saving while locked. Unlock to read; forgotten passphrases cannot be reset. Operational metadata stays readable. Session-only recovery, site/field exclusions, encrypted library backups and a popup wipe are available. Sensitive text cannot always be recognized. Clipboard history and exported copies remain outside extension controls.

Protection must be enabled before a loss, and the save must complete. This preview supports standard textareas and long ordinary text inputs on top-level web pages. It excludes incognito, rich text editors, frames, and sensitive-hint fields. Recovery cannot recover earlier unsaved text or extend a website's session. Keep a separate copy of important work.

**Suggested category:** Tools (under Productivity if grouped).

**Public URLs:**

- Source/support: https://github.com/librerob/draft-cairn
- Privacy policy: https://github.com/librerob/draft-cairn/blob/main/PRIVACY.md

## Single purpose and permission justifications

**Single purpose:** preserve and reuse long-form application answers locally on user-selected websites, including preventing declared-limit paste loss.

| Permission | Justification |
| --- | --- |
| `storage` | Local drafts, explicitly saved library answers, retention settings and site choices. No sync. |
| `scripting` | Register and inject the capture script only for granted hosts; enable it immediately in the chosen tab. |
| `activeTab` | Identify the user's chosen website when opening the toolbar popup, without global browsing-history permission. |
| `alarms` | Expire draft records periodically while Chrome runs. |
| Optional `http://*/*`, `https://*/*` | Allow the user to select an arbitrary application website. Only the exact chosen host pattern is requested in a user gesture. Chrome host grants cover all ports; the worker separately enforces the exact origin. No blanket host grant at installation. |

No remotely hosted code, externally connectable API, analytics, or server communication. Explain local handling of website contents accurately in the current dashboard's data-use fields; do not conflate “not transmitted to the developer” with “no sensitive information is processed.” The privacy policy describes local text, site metadata, clipboard/export, retention, and deletion.

## Data usage for this version

Disclose local handling of **Website content**, **Web history** (selected origins and recovery fingerprints), and **User activity** (typed/pasted answer capture). Narrative answers can contain **Personally identifiable information**, **Personal communications**, **Health information**, **Financial and payment information**, or **Location**, so disclose those categories when supported answers may contain them. Credential/OTP fields are excluded; the extension is not designed to collect authentication information. Do not treat heuristic filtering as a guarantee that arbitrary narrative text cannot contain sensitive details. The developer receives none of this data; that is separate from local handling. Review the exact current dashboard wording against [Google's data-use FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq).

No sale/transfer to third parties, unrelated use or credit/lending use. No remote code. Both modes encrypt answer records; the privacy policy explicitly distinguishes readable operational metadata and the same-profile automatic key from the optional passphrase vault. Do not claim the entire profile is encrypted by Draft Cairn or that encryption prevents live malware access.

## Submission checklist for the owner

- [ ] Test the unmodified release in a fresh supported Chrome profile: native optional permission approval/denial/revocation, browser restart, OS clipboard, keyboard-only editor use, and target portals with synthetic data.
- [ ] Review limitations and privacy policy for the exact version. Do not call the preview production-ready or universally compatible.
- [ ] Register/sign in to the intended Google developer account, verify email and publisher details, enable required two-step verification, and complete any identity/trader/contact verification currently required. Owner accepts legal agreements personally.
- [ ] Confirm the one-time registration fee (official source: US$5) and obtain explicit payment authorization before paying. No recurring services are required.
- [ ] Run CI and deterministic packaging. Verify `SHA256SUMS`. Upload only `draft-cairn-0.2.0.zip`, with `manifest.json` at its root.
- [ ] Supply the original 128×128 icon from `extension/icons/128.png`. The synthetic screenshots `docs/images/recovery.png` and `docs/images/library.png` are prepared at 1280×800. Review them against the current [image guide](https://developer.chrome.com/docs/webstore/images) before upload; they show the real extension UI with synthetic fixtures.
- [ ] Review and upload the prepared 440×280 small promotional tile, `docs/store/small-promo.png`, and any desired optional assets under the current image guide. No invented customers, rankings, or paid offers are included.
- [ ] Fill listing, single purpose, permission justifications, remote-code declaration, data-use/privacy fields, distribution, support/privacy URLs, and test instructions. Check consistency with `PRIVACY.md`.
- [ ] Choose free distribution; no advertised paid plans, trial, purchase feature, or sponsorship link is included.
- [ ] Supply reviewer steps: enable a localhost or reviewer-hosted synthetic form first, type/wait, reload, recover; paste beyond `maxlength`; inspect library and deletion. No reviewer credentials are needed.
- [ ] Obtain separate authorization for store submission. Submit for review only after that authorization, and address any reviewer findings.

Official references: [registration](https://developer.chrome.com/docs/webstore/register), [fee confirmation](https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard), [account setup](https://developer.chrome.com/docs/webstore/set-up-account), [publishing](https://developer.chrome.com/docs/webstore/publish), [images](https://developer.chrome.com/docs/webstore/images). Review times and approval are not guaranteed.
