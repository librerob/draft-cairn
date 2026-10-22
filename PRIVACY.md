# Privacy policy

Effective 22 October 2026 · Draft Cairn 0.1.1

Draft Cairn stores supported field text only on websites you explicitly enable. It also stores complete oversized pastes temporarily, and library answers you explicitly save or import. No account is required.

## Information stored

Recovery records contain answer text, website origin (scheme, host and port), a SHA-256 hash of the page origin and path, page title, field descriptors (including labels, names, IDs and form identifier), save time, expiry time, and form-structure hash. Raw URL paths, query strings, fragments, credentials, cookies, and browsing history are not stored. Titles and field descriptors can contain personal information.

Library records contain title, answer text, optional project, local identifier, and save time. Settings include protected origins and retention period. The extension does not use Chrome Sync.

## What leaves the device

The extension does not transmit answers, settings, telemetry, or error reports. It contains no analytics, ads, affiliate injection, remote AI, remote scripts, or server connections. Its source link opens GitHub only when clicked; GitHub then applies its own policies. Library export writes a file on your device; copying writes to the system clipboard, which other applications or operating-system clipboard services may access. Text explicitly restored into a website becomes available to that website and its scripts, like text you type there.

## Exclusions and limitations

Password, hidden, payment, one-time-code, and other sensitive-hint fields are filtered. Only standard long-answer fields are eligible. Autocomplete hints other than `on`, including `off`, are excluded. Incognito is disabled. Filtering is imperfect: ordinary narrative answers can contain confidential information. Use only where you have authority to keep a local copy and understand the website's rules.

Storage is not encrypted by Draft Cairn, and this is not a secure vault. People or software with access to your browser profile or device may read it. On-page editor contents are shown within the website and should not be treated as isolated from a hostile website. Local deletion is not a forensic secure erase and may not remove OS or device backups.

## Retention and deletion

Recovery defaults to seven days; options are 1, 3, 7, 14, or 30 days. Original oversized pastes expire within one hour or sooner if deleted. Expired records are excluded on every read and purged on the next successful write, hourly cleanup, or startup while Chrome is running. Chrome must run for scheduled deletion; closed-browser files may retain expired bytes until cleanup succeeds. Library answers remain until explicitly deleted.

The workspace can delete individual revisions, all drafts and protection settings for a website, individual library answers, or all extension data and granted website access. Site deletion does not delete manually saved library answers, which have no site association. Exports, the clipboard, browser-profile backups, and copies restored onto websites are outside the extension's deletion controls. Uninstalling removes extension storage according to Chrome's normal behavior.

## Questions and reports

Use [GitHub issues](https://github.com/librerob/draft-cairn/issues) for general questions with synthetic examples only. Never post confidential answers. Use the private security reporting route described in [SECURITY.md](SECURITY.md) for vulnerabilities.
