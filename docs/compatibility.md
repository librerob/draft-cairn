# Compatibility and recovery limits

Chrome 120+ · Manifest V3 · preview release

Supported: editable visible standard textareas and `input type=text` with `maxlength` at least 120, in the top-level HTTP/HTTPS page. Long ordinary inputs without a declared limit are deliberately skipped. Dynamic fields are handled through delegated trusted input and paste events. Programmatically dispatched events are ignored; sites that make changes without real input events may not save them. Unsupported editable focus shows “not protected in this field”; no focused supported field shows a neutral prompt. Standard `input` and `change` events are dispatched after an explicit restoration; framework-controlled fields may still reject or transform text.

## Targeted rich text

Plain-text capture also recognizes top-level editable DIV roots for Quill (`ql-editor`), ProseMirror/Tiptap (`ProseMirror`), CKEditor 5 (`ck-editor__editable` with textbox role), and inline TinyMCE (`mce-content-body`). These are DOM adapters, not privileged integrations with vendor APIs. They capture rendered text after trusted input, including events originating in nested paragraphs. Formatting, images, attachments and editor document models are not saved. All rich-text recovery is **copy back only**, even with page details enabled. Generic contenteditable fields are not automatically included. Consult the [public sample matrix](portal-matrix.md) for which actual configurations have been exercised; recognizing an editor's class is not proof of every version or portal integration.

Excluded: incognito, frames (including iframe-based TinyMCE), generic contenteditable, shadow-root fields, password/payment/OTP/hidden fields, disabled/read-only/inert fields, fields with sensitive autocomplete tokens (ordinary `off` is supported), and elements inside `data-cairn-ignore`. Rich roots containing nested inputs, autocomplete attributes or private regions are skipped. The extension UI is excluded from capture.

## Paste checks

The pre-paste warning reads the actual HTML `maxlength`. It accounts for existing content and the current selection, using UTF-16 units. Code points, graphemes, words, bytes, and a portal's custom JavaScript counters can differ. The extension never shortens answers.

For an allowed plain-text paste, Draft Cairn compares the visible field value with the expected selection replacement after 1.5 seconds. CRLF/CR line endings become LF; other whitespace and Unicode remain significant. A difference, including a website cancelling the paste, preserves the complete clipboard original in an encrypted recovery record for up to one hour **if saving succeeds**. Click the warning pill to review/copy the original, see the observed field text, lengths and first difference, or dismiss the warning. It never overwrites the website to fix a difference. A visible match does not verify server acceptance, a submitted application or changes after the observation window.

Rich-text checks compare empty fields and whole-field selections when their plain text can be matched. Other rich selections retain the original for manual review without claiming that text was lost. Continued trusted typing, another paste, page hiding, or an unavailable field interrupts comparison and preserves the original when possible. Partial rich pastes therefore create an extra short-lived recovery record. Matching ordinary pastes do not create a separate clipboard-original record; ordinary answer autosaving still applies.

Only the plain-text part of a deliberate trusted paste into an eligible field is inspected; there is no general clipboard monitoring or clipboard permission. HTML/formatting, special browser paste modes, scripts that intercept events before the extension, fields awaiting exclusion checks and originals over 100,000 UTF-16 units cannot be verified reliably. At most four review originals/observations are retained in this page's memory until dismissed, reload, protection off or page close. Locking the vault does not scrub these copies already present on a website. Custom changes after 1.5 seconds and server-side limits remain outside detection.

Oversized paste is blocked and the full clipboard text is opened in an accessible native dialog with a large textarea. A separate original-paste recovery record expires within one hour if the save succeeds. The larger editor also opens by clicking the on-page protection badge after focusing a supported field. Editor changes are in-memory until copied; the original saved paste is not silently replaced. Closing the editor discards unsaved editor edits.

Captures debounce for 250 ms and flush on focus loss, page hiding, or navigation where the browser permits. A hard crash, very fast reload, suspended worker, quota error, offline extension context, or abrupt device shutdown can lose the latest unsaved changes. A removed field can disappear before its snapshot is made. “Saved on this device” reports a completed storage write, not a backup guarantee. Recovery requires protection to have been enabled before the loss. Turning it on later cannot recover earlier text. It cannot extend a website login or prevent server-side session expiry.

Direct restore requires the original hashed origin/path, unchanged eligible field structure, and exactly one matching descriptor with a name or ID. Repeated/anonymous fields, changed labels, changed forms, page query/fragment routes, and nonempty destinations support copying instead. Multiple records may appear for visually similar fields; inspect the label, page title, site, saved time and full text. The identity check cannot distinguish a new client record at the same path if the site reuses identical fields; verify the destination yourself.

Origin checks include ports. Chrome host permissions ignore ports, so the browser grant is broader than the exact origin where Draft Cairn permits capture. HTTP and HTTPS, subdomains, and different origins must each be enabled separately. Chrome Web Store and browser-managed pages can forbid injection despite a grant; use the visible saved state as the evidence that capture works.

The 180-record/6 MiB recovery budget is rolling: oldest recovery records can be evicted before expiry, with a visible notice. Explicit library answers are not evicted. New library writes reserve space for recovery.

Expiry is enforced on reads and cleanup attempts while Chrome runs, not while the browser is closed. Site deletion keeps explicitly saved library answers. Clearing extension data does not erase exports, OS clipboard history, browser-profile backups, or the website's own copies.

Direct restoration also requires saving page titles and field details in settings before capture. New installations leave this off and use copy-only recovery. Enabling the option does not recreate descriptors for older drafts. Vault reading/restoration requires unlocking; capture can continue while locked.
