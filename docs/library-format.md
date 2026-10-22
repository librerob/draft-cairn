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
