# Chrome Web Store preparation

Checked 22 October 2026. No upload, payment, registration, or store submission has been performed.

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

Review saved revisions with the page title, site, field label, and saved time. Copy an answer, or explicitly restore it to an empty field when the match is clear. Nothing is restored or submitted automatically.

Before a paste exceeds an HTML field's declared character limit, Draft Cairn stops the paste and opens a larger editor with the complete original and a counter. It does not detect every custom website limit and never rewrites or shortens your answer.

Keep reusable answers in a simple library with titles, projects, search, copying, and JSON export/import. All implemented local features are free.

No account, analytics, ads, remote AI, or answer transmission. Answers stay in this browser profile. Recovery drafts default to seven days; temporary original pastes last up to one hour. Library answers stay until deleted. Local browser storage is not an encrypted vault, and sensitive text cannot always be recognized.

Protection must be enabled before a loss, and the save must complete. This preview supports standard textareas and long ordinary text inputs on top-level web pages. It excludes incognito, rich text editors, frames, and sensitive-hint fields. Recovery cannot recover earlier unsaved text or extend a website's session. Keep a separate copy of important work.

**Suggested category:** Productivity (choose the corresponding current dashboard category).

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

## Submission checklist for the owner

- [ ] Test the unmodified release in a fresh supported Chrome profile: native optional permission approval/denial/revocation, browser restart, OS clipboard, keyboard-only editor use, and target portals with synthetic data.
- [ ] Review limitations and privacy policy for the exact version. Do not call the preview production-ready or universally compatible.
- [ ] Register/sign in to the intended Google developer account, verify email and publisher details, enable required two-step verification, and complete any identity/trader/contact verification currently required. Owner accepts legal agreements personally.
- [ ] Confirm the one-time registration fee (official source: US$5) and obtain explicit payment authorization before paying. No recurring services are required.
- [ ] Run CI and deterministic packaging. Verify `SHA256SUMS`. Upload only `draft-cairn-0.1.0.zip`, with `manifest.json` at its root.
- [ ] Supply the original 128×128 icon from `extension/icons/128.png`. The synthetic screenshots `docs/images/recovery.png` and `docs/images/library.png` are prepared at 1280×800. Review them against the current [image guide](https://developer.chrome.com/docs/webstore/images) before upload; they show the real extension UI with synthetic fixtures.
- [ ] Review and upload the prepared 440×280 small promotional tile, `docs/store/small-promo.png`, and any desired optional assets under the current image guide. No invented customers, rankings, or paid offers are included.
- [ ] Fill listing, single purpose, permission justifications, remote-code declaration, data-use/privacy fields, distribution, support/privacy URLs, and test instructions. Check consistency with `PRIVACY.md`.
- [ ] Choose free distribution; no advertised paid plans, trial, purchase feature, or sponsorship link is included.
- [ ] Supply reviewer steps: enable a localhost or reviewer-hosted synthetic form first, type/wait, reload, recover; paste beyond `maxlength`; inspect library and deletion. No reviewer credentials are needed.
- [ ] Obtain separate authorization for store submission. Submit for review only after that authorization, and address any reviewer findings.

Official references: [registration](https://developer.chrome.com/docs/webstore/register), [fee confirmation](https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard), [account setup](https://developer.chrome.com/docs/webstore/set-up-account), [publishing](https://developer.chrome.com/docs/webstore/publish), [images](https://developer.chrome.com/docs/webstore/images). Review times and approval are not guaranteed.
