# Privacy policy

Effective 22 October 2026 · Draft Cairn 0.2.0 preview

Draft Cairn keeps supported field text only on websites you explicitly enable. It also keeps complete oversized pastes temporarily, and library answers you deliberately save or import. No account is required. Nothing is sent to the developer.

## Information handled

Recovery records contain answer text, the exact website origin (scheme, host and port), hashed page and field fingerprints, save and expiry times, and a form-structure hash. Saving page titles and field details (labels, IDs, names, form identifier and other field attributes) is optional. This option is off for new installations; existing installations keep their previous behavior. Turning it off removes those details from existing recovery records and makes them copy-only. Titles and field details can contain personal information.

Raw URL paths, query strings, fragments, cookies and a general browsing-history log are not stored. Hashes are fingerprints, not guaranteed anonymization: someone who knows candidate pages or fields may guess them. Selected site origins are retained for capture and recovery. Arbitrary narrative answers can contain sensitive information even when credential fields are excluded.

Library records contain title, answer text, optional project, local identifier and save time. They have no website association. Settings include selected and blocked origins, field exclusions, retention, metadata and session-storage choices, and encryption mode. The extension does not use Chrome Sync.

## Encryption choices

Answer records are encrypted in both modes, using Web Crypto with no remote key service:

- **Automatic encryption (default):** AES-256-GCM with a fresh random 96-bit IV and authenticated record identifier. The non-extractable key lives in extension-origin IndexedDB in the same browser profile. No password is needed. Someone who controls or copies the complete profile may still use that key to decrypt answers; this mode is not protection against profile theft.
- **Optional passphrase vault:** each record has its own random AES-256-GCM key, wrapped with RSA-OAEP (3072-bit, SHA-256). The private key is encrypted with a passphrase-derived AES-256-GCM key using PBKDF2-SHA-256, 600,000 iterations and a random 128-bit salt. The public key permits new captures while locked. Reading, searching, restoring and library changes require unlocking. A forgotten passphrase cannot be reset: saved drafts and library answers become unrecoverable. Wiping remains available without the passphrase.

The passphrase is not stored. While unlocked, a serialized private key is kept in trusted `chrome.storage.session` memory so unlocking survives service-worker suspension. It is imported as a non-extractable Web Crypto key for use. Explicit locking removes that session entry and clears the worker's decrypted-record cache; open workspaces clear rendered answers and unsaved editors. Closing Chrome completely, reloading/disabling the extension, or clearing the extension session also removes the session key. Closing the last window may leave Chrome running in the background.

An operational index uses a separate automatic AES-256-GCM key stored in the same profile. It can be read by someone controlling or copying that profile in both modes. It contains: enabled/blocked origins, exclusion hashes and associated origins, retention settings, record identifiers, hashed grouping/site fingerprints, counts, sizes, save/expiry times, vault public key and passphrase-wrapping parameters. Answer text, library titles/projects, page titles and field descriptors are encrypted. The vault protects answer contents in copied profile files or backups made after setup, not the operational metadata protected by the same-profile automatic key. It cannot protect earlier plaintext copies, older automatic-encryption backups, exported readable files, screenshots, text on websites, a compromised live browser, or malware on an unlocked device. There is no independent security audit.

Records, index updates and key changes commit together in an IndexedDB transaction. Upgrades preserve the old store until the new encrypted store commits; cleanup then removes old records and the legacy key. Local deletion is not a forensic secure erase: old disk sectors, OS snapshots and backups may retain previous data. Storage pressure, browser/profile removal, lost keys or device failure can still destroy local data. Keep a separate copy of important work.

## What leaves the extension

There are no analytics, ads, affiliate injection, remote AI, remote scripts, server connections or error-report uploads. The source link opens GitHub only when clicked; GitHub then applies its own policies. Library export writes a local file. Readable JSON exports contain complete answers; encrypted exports require the separate passphrase chosen for that file. Changing the vault passphrase does not change existing export files.

Copy writes to the system clipboard. Other apps, clipboard managers, Windows clipboard history and cross-device clipboard services may retain or synchronize it. Locking/wiping cannot clear those copies. Explicit restoration makes text available to the website and its scripts, just like text typed there. The on-page editor is displayed on a website and should not be treated as a secure vault interface against a hostile website.

## Capture exclusions

Only visible, editable standard long-answer fields on enabled top-level pages qualify. Password, payment, one-time-code, hidden and other sensitive-hint fields are filtered. Sensitive autocomplete tokens are excluded; `autocomplete="off"` is allowed. Incognito, frames and rich-text editors are unsupported. Filters are imperfect. Use only where you have authority to retain a local copy.

You can block a site from the popup. A field can be excluded from the larger on-page editor; fields with the same identity on that page are excluded together and their recovery revisions are deleted. A hashed exclusion and its origin are retained until removed in settings. Blocking a site stops capture but keeps earlier drafts unless you delete them.

## Retention and deletion

New installations default to one day of recovery. Existing installations retain their choice. Options are 1, 3, 7, 14 or 30 days. Original oversized pastes expire within one hour. Expired records are excluded on reads and removed on successful writes, hourly cleanup or startup while Chrome runs. Closed-browser files may retain expired bytes until cleanup succeeds.

Recovery is a rolling buffer: the oldest revisions can disappear earlier at the 180-record or 6 MiB total plaintext budget. Library capacity reserves space for recovery; library answers are never evicted. Evictions are shown in the UI.

Optional **session-only recovery** moves encrypted recovery records into trusted browser-session memory with a smaller 2 MiB plaintext budget. Switching can evict oldest recovery revisions to fit. Drafts disappear when the extension/browser session ends; library answers remain persistent. Switching back makes currently surviving drafts persistent again; it cannot recover drafts from an ended session.

Individual drafts, site drafts/access, library answers or all extension data can be deleted. Delete all is available in both the workspace and popup, even when the vault is locked, and removes keys/settings/site access too. Site deletion does not remove manually saved library answers. Exports, clipboard history, backups and copies on websites are outside these controls. Uninstalling removes extension storage according to Chrome's normal behavior.

## Limited use and contact

Handled data is used only for the disclosed answer-recovery, paste-protection and answer-library features. It is not sold, used for advertising or credit decisions, or made accessible to the developer. Use follows the Chrome Web Store User Data Policy, including Limited Use requirements.

Use [GitHub issues](https://github.com/librerob/draft-cairn/issues) for general questions with synthetic examples only. Never post confidential answers. For vulnerabilities use the route in [SECURITY.md](SECURITY.md).
