# Library exchange format v1

UTF-8 JSON, maximum 6 MiB file size, format identifier `draft-cairn-library`, integer version `1`.

```json
{
  "format": "draft-cairn-library",
  "version": 1,
  "answers": [
    {"title": "Synthetic overview", "project": "Practice project", "text": "A synthetic answer for demonstration."}
  ]
}
```

`answers` must be an array of at most 300 objects. `title` is a nonempty string up to 160 UTF-16 units; `text` is nonblank and up to 100,000 units; `project` is optional and up to 100 units. Unknown properties are ignored and never merged into storage. The whole import is validated and checked against storage capacity before writing; any invalid record rejects the whole import. Exact title/text/project duplicates are skipped. New local IDs and times are assigned. No sites, permissions, draft histories, or executable formatting are imported.

Exports contain only this schema, without IDs or times. The format has no encryption. Exported answers may be confidential: protect the file and avoid committing it to a repository. Unsupported versions are rejected so future migrations must be explicit.

## Optional encrypted envelope (v1)

The readable schema above remains unchanged. The encrypted export has `format: "draft-cairn-encrypted-library"`, integer `version: 1`, a `kdf` object (`name: "PBKDF2"`, `hash: "SHA-256"`, 600,000 iterations, base64 16-byte salt), and `payload` (`v: 1`, base64 12-byte `iv`, base64 AES-GCM ciphertext plus tag in `data`). It encrypts the complete JSON object above using a 256-bit passphrase-derived key and the fixed authenticated label `draft-cairn-library-export-v1`. It contains no vault private key.

The export passphrase is independent of vault settings and cannot be reset. Import accepts an envelope up to 12 MiB, checks bounded KDF costs before doing work, authenticates/decrypts, then validates the entire readable schema and storage budget before mutation. Wrong passwords, damaged ciphertext and malformed answers reject the whole import. Neither backup format imports capture settings or enables sites.
