# Compatibility and recovery limits

Chrome 120+ · Manifest V3 · preview release

Supported: editable visible standard textareas and `input type=text` with `maxlength` at least 120, in the top-level HTTP/HTTPS page. Long ordinary inputs without a declared limit are deliberately skipped. Dynamic fields are handled through delegated events. Standard `input` and `change` events are dispatched after an explicit restoration; framework-controlled fields may still reject or transform text.

Excluded: incognito, frames, rich text/contenteditable, shadow-root fields, password/payment/OTP/hidden fields, disabled/read-only/inert fields, fields with non-`on` autocomplete hints (including `off`), and elements inside `data-cairn-ignore`. The extension UI is excluded from capture.

The paste warning reads the actual HTML `maxlength`. It accounts for existing content and the current selection, using UTF-16 units. Code points, graphemes, words, bytes, and a portal's custom JavaScript counters can differ. Custom and server-side limits cannot be inferred reliably and are not detected. Clipboard events with no plain-text content, browser special paste modes, and website event handlers may bypass the warning. The extension never shortens answers.

Oversized paste is blocked and the full clipboard text is opened in an accessible native dialog with a large textarea. A separate original-paste recovery record expires within one hour if the save succeeds. The larger editor also opens by clicking the on-page protection badge after focusing a supported field. Editor changes are in-memory until copied; the original saved paste is not silently replaced. Closing the editor discards unsaved editor edits.

Captures debounce for 250 ms and flush on focus loss, page hiding, or navigation where the browser permits. A hard crash, very fast reload, suspended worker, quota error, offline extension context, or abrupt device shutdown can lose the latest unsaved changes. A removed field can disappear before its snapshot is made. “Saved on this device” reports a completed storage write, not a backup guarantee. Recovery requires protection to have been enabled before the loss. Turning it on later cannot recover earlier text. It cannot extend a website login or prevent server-side session expiry.

Direct restore requires the original hashed origin/path, unchanged eligible field structure, and exactly one matching descriptor with a name or ID. Repeated/anonymous fields, changed labels, changed forms, page query/fragment routes, and nonempty destinations support copying instead. Multiple records may appear for visually similar fields; inspect the label, page title, site, saved time and full text. The identity check cannot distinguish a new client record at the same path if the site reuses identical fields; verify the destination yourself.

Origin checks include ports. Chrome host permissions ignore ports, so the browser grant is broader than the exact origin where Draft Cairn permits capture. HTTP and HTTPS, subdomains, and different origins must each be enabled separately. Chrome Web Store and browser-managed pages can forbid injection despite a grant; use the visible saved state as the evidence that capture works.

Expiry is enforced on reads and cleanup attempts while Chrome runs, not while the browser is closed. Site deletion keeps explicitly saved library answers. Clearing extension data does not erase exports, OS clipboard history, browser-profile backups, or the website's own copies.
