# Public application compatibility matrix

Tested 23 October 2026 using Chromium 151.0.7922.34 on Linux, the real installed extension and synthetic narrative text. **Three application samples passed capture, visible-paste comparison and saved-text recovery after reload.** This is sample-level evidence, not certification of an entire platform or a completed application workflow.

[Recorded results](portal-results-0.3.0.json) · [Public-site run](https://github.com/librerob/draft-cairn/actions/runs/39994314548) · tested runtime commit `f9707b432abc1367129b003b80caf688825f8a53`. The harness pre-grants named test hosts in a temporary manifest; native permission prompts remain a separate manual check. A successful collection workflow does not mean every row passed.

| Platform and exact sample | Typing capture | Visible paste / recovery after reload | Direct restore | Scope and limitation |
| --- | --- | --- | --- | --- |
| [Jotform grant preview](https://www.jotform.com/form-templates/preview/50246885080962/classic&nofs&disableSmartEmbed=1) | Passed, textarea `input_33` | Passed / passed | Refused after reload; copy back available | Opened the template preview as a standalone page and used Next to reach its narrative page without entering contact information. The embedded preview on the template landing page is unsupported. |
| [Greenhouse application](https://job-boards.greenhouse.io/anthropic/jobs/5065894008) | Passed, textarea `question_14439958008` | Passed / passed | Passed into the empty matched field | One public application question, tested without signing in or submitting an application. Other questions, uploads and tenant configurations were not tested. |
| [Ashby application](https://jobs.ashbyhq.com/Ashby/0f5dbf59-687b-4d88-88a7-73ee0a66b48d/application) | Passed, textarea | Passed / passed | Copy back only | Opened the Application view of this public role. The tested entry retained a query string, so conservative restoration rules disabled direct restore. |
| [SmartyGrants training round](https://training4.smartygrants.com.au/testround) | Not verified | Not verified | Not verified | Reached the public round information page; no editable narrative application field was reached without an applicant session. The closed Sneak Peek TEST round was also inspected. No account was created. |
| [Submittable sign-in](https://manager.submittable.com/signin) | Not verified | Not verified | Not verified | Redirected to sign-in. No account, application fields or authenticated workflow were tested. This row does not establish compatibility. |

For each passing sample, the harness typed a unique synthetic narrative, checked its saved contents, pasted different synthetic text with a trusted keyboard shortcut, confirmed that the visible paste matched and the pasted answer was saved, reloaded the page, and verified the saved pasted answer remained available. The Greenhouse test also requested explicit restoration. It did not press Submit, create an account, upload a document, fill personal/financial information, solve a CAPTCHA or verify the server's receipt of an application. Native OS clipboard behavior, forced session expiry and full multipage workflows remain unverified.

## Actual rich-editor demos

| Official public demo | Typed plain-text capture | Whole-field paste check / saved paste after reload | Recovery |
| --- | --- | --- | --- |
| [Quill](https://quilljs.com/) | Passed | Passed / passed | Copy back only |
| [ProseMirror](https://prosemirror.net/examples/basic/) | Passed | Passed / passed | Copy back only |
| [CKEditor 5](https://ckeditor.com/ckeditor-5/demo/feature-rich/) | Passed | Passed / passed | Copy back only |
| Inline TinyMCE | DOM adapter fixture passed; vendor demo not tested | Not established on a vendor demo | Copy back only; iframe TinyMCE excluded |
| Tiptap | Shares the ProseMirror DOM adapter; no separate live Tiptap configuration tested | Not separately established | Copy back only |

These checks save rendered words, not formatting, images, attachments, collaboration state or the editor's internal document model. Quill and CKEditor consume native editing events differently from ordinary fields; the extension observes rendered text after trusted beforeinput editing intent and persists the checked result of trusted pastes too. Partial rich-text selections keep the clipboard original for manual comparison instead of claiming a reliable automatic match.

## Additional access observations

Cognito Forms' public grant template embeds a multipage form. Neither the landing page nor its standalone first page exposed an eligible narrative textarea during this check; later pages were not exercised. Wufoo's public builder did not expose an eligible editable narrative field in its initial state. These are **not compatibility passes**, and neither substitutes for a real applicant workflow.

## Reproduce or report a different configuration

Run `npm ci --ignore-scripts`, `npx playwright install chromium`, then `node tests/portals.mjs`, or dispatch the **Public portal compatibility** workflow. This opt-in test contacts only the listed public samples, uses a disposable profile and writes a compact JSON report plus synthetic screenshots to `test-results/portals/`. Sites may change, close their samples, introduce access checks or use different field configurations. The results file omits URL queries/fragments and does not contain answer text or credentials.

Use the [native Chrome smoke-test worksheet](store/manual-smoke-test.md) with the unmodified ZIP before Web Store submission. A new report should identify the sample, date, Chrome/OS version, field type, saved-text and reload result, and any access blocker. Never attach real answers, profile data, session tokens or a live confidential application URL to a public issue. See [compatibility boundaries](compatibility.md) for timing, sensitive-field exclusions and restore requirements.
