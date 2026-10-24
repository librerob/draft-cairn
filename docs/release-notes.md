Draft Cairn 0.3.1 — fix the narrow Chrome toolbar popup.

The popup now declares its minimum width on the document and no longer caps its body against Chrome's initial viewport. This prevents the narrow column of wrapped text reported in the published extension.

The light/dark interface, paste checks, recovery, answer library and encryption behavior are unchanged. No new permissions are added.

Validation includes the existing unit and Chromium regression suites plus a headed Chromium test opening the actual toolbar popup, rather than a tab with a preset viewport. See docs/validation.md for the exact results and remaining manual checks. The public portal matrix retains its dated 0.3.0 evidence; portal behavior was not changed by this layout fix.

Update the existing Chrome Web Store item using draft-cairn-0.3.1.zip. Its manifest version is higher than 0.3.0. Upload only the install ZIP, not the outer preparation kit. Reload a test website after the update and open the toolbar popup again.
