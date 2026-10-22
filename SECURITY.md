# Security policy

The latest 0.2.x preview is the supported line. It has not received an independent security audit. Never submit real answers, profile files, tokens or sensitive URLs to public issues.

For vulnerabilities use GitHub private vulnerability reporting if available in the Security tab. Otherwise open a minimal public issue requesting a private reporting route without exploit details or data. Do not send confidential material before a private channel is agreed.

## Boundaries

- Accidental form loss is the primary problem. Capture requires per-origin opt-in, a granted host and a top-level non-incognito sender. Chrome grants hosts across ports; the worker checks the exact origin independently.
- Trusted input/paste events reduce direct synthetic-event flooding. A hostile website can still manipulate its fields during real interaction, remove/spoof the status, or observe its own text. The extension is detectable.
- The worker validates senders, text lengths and field attributes; derives origin/path fingerprints from Chrome sender metadata; and serializes changes. Content scripts receive only save responses, exclusion hashes and explicitly requested restoration text. Storage/session access is restricted to trusted extension contexts.
- Bounds: 180 recovery revisions, 300 library answers, 100,000 UTF-16 units per answer and a 6 MiB plaintext budget. Oldest drafts are evicted rather than blocking new capture. A 700 KiB recovery reserve constrains library writes. Session-only recovery has a 2 MiB plaintext cap.
- Persistent encrypted records, operational index and key changes share one IndexedDB transaction. Saving one changed answer does not serialize every answer. Migration/rekey failure preserves the previously committed generation. Memory-only drafts are staged with a new session index before its pointer commits; unreferenced staged values are removed.
- Automatic record encryption uses a same-profile non-extractable AES-256-GCM key. The optional vault uses per-record AES-256-GCM, RSA-OAEP-3072/SHA-256 key wrapping and PBKDF2-SHA-256 (600,000 iterations, random salt) to protect the private key. See [PRIVACY.md](PRIVACY.md) for the readable operational index and precise limits.
- Capture needs only the public key while locked. An unlocked serialized private key exists in trusted session memory and is imported non-extractably for use; `CryptoKey` objects are not passed to JSON-only Chrome storage. Lock clears the session secret, decrypted worker cache, rendered workspace answers and unsaved workspace editors. A malicious live browser/device remains outside the threat model. JavaScript cannot promise forensic erasure of memory.
- Passphrases/keys are never logged or sent to a server. Wrong passwords and ciphertext authentication failures fail closed. Missing keys do not cause silent key replacement over existing records. There is no password reset.
- The operational index is not a tamper-proof audit log. Profile-level attackers can delete or alter configuration/index metadata. Vault confidentiality is for encrypted answer payloads in copied files, not metadata privacy, availability or an actively compromised browser.
- Switching to a vault cannot revoke older automatic-encryption keys or readable answers in OS snapshots/backups. IndexedDB deletion is not secure disk erasure. Local storage is not a durable backup service.
- Rendering uses text/value sinks. The CSP prohibits remote scripts, objects and connections. No runtime dependencies ship. Restoration requires explicit confirmation, a unique unchanged field structure and an empty destination; query/fragment pages and metadata-minimized drafts are copy-only. Check restored text before submission.
- Encrypted export passwords belong to the file, independently of the vault. Readable export and clipboard remain explicit escape routes for unlocked text. Clipboard managers/history and copied files remain outside lock/wipe controls.

## Release review

Run unit, static, real-browser and reproducible-package checks. Cover failed migrations/rekeys, wrong passwords, locked capture, worker/browser restart, session expiry, UI scrubbing, backup tampering, exclusions, permissions and deletion. Use synthetic fixtures only; never upload real captured text, browser profiles, logs, traces or screenshots. See [validation](docs/validation.md) for measured checks and manual gaps.
