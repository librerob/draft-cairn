# Final Chrome smoke test

Status: **not yet performed on the unmodified 0.3.0 ZIP**. Automated Chromium tests use a test-only localhost host grant; they cannot stand in for these checks. Use only synthetic text. Stop submission if a required step fails.

1. Extract `draft-cairn-0.3.0.zip` and load that extracted folder in a fresh supported Chrome profile via `chrome://extensions` → Developer mode → Load unpacked. Pin the extension. Do not change its manifest or permissions.
2. Run `node scripts/demo.mjs` from a source checkout and open `http://127.0.0.1:8765/index.html` in that Chrome profile. Before enabling protection, type a synthetic answer. Confirm no draft is captured.
3. Open the popup and choose Enable for this site. Deny Chrome's native access request. Confirm protection stays off. Repeat and approve. If Chrome closes the popup, reopen it and confirm protection has finished enabling. Type a new synthetic answer in Project summary and wait for “saved on this device”.
4. Reload the demo, open Recovery & library, and restore the saved answer into the now-empty Project summary field. Check it is exact. Put new text in the destination and confirm restoration refuses to overwrite it.
5. Use the demo's Copy synthetic long answer button and **the OS paste shortcut** in Project summary. Test once with existing text and once with some text selected. An oversized paste must leave the field unchanged and show the complete original in the larger editor. Use Tab, Shift+Tab, and Escape to inspect focus and close behavior. Copy from the editor and paste into a disposable local text editor to verify exact content.
6. Save a synthetic library answer, export it, delete it, and import the exported file. Verify search, project, and copying. Delete the exported test file yourself afterward if desired.
7. Close and fully restart Chrome. Confirm retained drafts and the explicit library answer remain. Use the session-expiry button and recover after returning to the empty form.
8. Turn protection off in the popup, type another distinct synthetic answer, and confirm it is not captured. Re-enable in the same page. Separately revoke this site's access through Chrome's extension controls; confirm further capture stops. Check status/error messages are understandable. Focus an unsupported rich-text editor and each excluded input; the on-page status must say not protected in this field. Test an ordinary form with autocomplete=off. A successful unrelated action must not clear a prior failure badge; acknowledge it in the workspace.
9. Check the two identically labelled fields refuse direct restoration. Check password, payment, one-time-code, ignored-note, and short-input fixture values are absent from recovery.
10. Delete site data, then all extension data. Confirm the relevant records and site access are gone. Use synthetic data on two or three intended application portals too, with permission to do so; record the exact portal and supported/unsupported fields privately without saving actual client text.

Record Chrome/OS version, date, pass/fail, and any issue using synthetic descriptions. The local Windows environment blocked the downloaded Chrome for Testing binary by application-control policy; that policy was not bypassed. Native Chrome permission and OS clipboard checks remain a submission gate until the owner or an available compatible environment completes them.

## Optional vault and privacy controls

- [ ] Fresh install: one-day retention, page details off; supported typing saves and is copy-only.
- [ ] Enable page details, type/wait/reload, restore into a uniquely matched empty field. Turn details off and confirm prior titles/descriptors disappear and restore is unavailable.
- [ ] Enable vault with a saved passphrase; acknowledge unrecoverability. Wrong passphrase reveals nothing. Lock clears rendered answers and unsaved workspace editor text in every open workspace.
- [ ] Type/wait while locked; unlock and recover that exact answer. Suspend/restart the service worker: unlock persists. Fully exit/restart Chrome: vault locks and saving still works.
- [ ] Change passphrase, reject old/accept new. Return to automatic encryption with the current password; restart and recover without a password.
- [ ] Session-only: warn about smaller budget; fully end Chrome/extension session, verify drafts gone but library retained. Test with Chrome background mode enabled too.
- [ ] Encrypted export/import: wrong password/tampered file rejected; correct password works. Readable export warning is clear.
- [ ] Exclude a field in its larger editor; verify warning/no more captures across reload. Remove exclusion. Block/unblock a site.
- [ ] Popup Delete all while locked removes answers, vault/settings/access. Clipboard/history/export files remain outside the wipe.

## Appearance

- [ ] Switch the OS/browser between light and dark while System is selected; inspect workspace, popup and on-page editor.
- [ ] Choose Light/Dark explicitly, reload/restart, and verify the override survives and synchronizes across open extension pages.
- [ ] Check at increased text size, a narrow viewport, reduced motion and Windows High Contrast.
