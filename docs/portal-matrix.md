# Public application compatibility matrix

5 November 2026 · Draft Cairn 0.4.0 · Linux Chromium 151.0.7922.34 · synthetic narratives only.

**Three public application samples passed capture, visible-paste checks and saved-text recovery after reload.** These results apply to the exact samples/configurations below, not every tenant or a completed application workflow.

[Recorded results](portal-results-0.4.0.json) · [Passing collection run](https://github.com/librerob/draft-cairn/actions/runs/42023649710) · tested runtime commit `5048269d37b4fb237d320096c40de4653ce66beb`. A collection run succeeding does not mean every row passed. Native permissions are pre-granted only in a temporary test manifest.

| Exact sample | Typing / saved paste / reload recovery | Direct restore | Limit |
| --- | --- | --- | --- |
| [Jotform standalone grant preview](https://www.jotform.com/form-templates/preview/50246885080962/classic&nofs&disableSmartEmbed=1), textarea input_33 | Passed / passed / passed | Refused after reload; copy back available | Reached a narrative after Next without entering contact details. |
| [Greenhouse application](https://job-boards.greenhouse.io/anthropic/jobs/5065894008), textarea question_14439958008 | Passed / passed / passed | Passed into an empty matched field | One public question, no account or application submission. |
| [Ashby application](https://jobs.ashbyhq.com/Ashby/0f5dbf59-687b-4d88-88a7-73ee0a66b48d/application), textarea | Passed / passed / passed | Copy only | Query-based entry; no full application workflow. |
| Jotform embedded preview on its template landing page | Not verified | Copy only by design | Both origins enabled; no eligible narrative reached in the embedded check. Standalone success does not establish embedding success. |
| Cognito grant template, embedded and standalone | Not verified | Not established | No eligible narrative reached in the initial configuration. |
| Wufoo public builder | Not verified | Not established | No eligible narrative reached; a builder is not an applicant workflow. |
| [SmartyGrants training round](https://training4.smartygrants.com.au/testround) | Not verified | Not established | Reached round information, not an authorized applicant narrative. |
| [Submittable](https://manager.submittable.com/signin) | Not verified | Not established | Sign-in required. No account used. |
| Fluxx, Foundant, WizeHive / Zengine | Not verified | Not established | Authorized tenant sessions were not available or exercised. |

The passing checks use trusted typing and paste, confirm exact saved synthetic text, reload, then verify the saved pasted answer remains available. Only Greenhouse passed direct restoration in this public run. No form was submitted, no applicant account was created, and no contact/financial/client information was entered. Native OS clipboard behavior, forced remote session expiry and complete multipage workflows remain unverified.

## Editor and component evidence

| Configuration | Evidence | Recovery |
| --- | --- | --- |
| [Quill official demo](https://quilljs.com/) | Typed text, trusted whole-field paste and saved text after reload passed | Plain text, copy only |
| [ProseMirror official demo](https://prosemirror.net/examples/basic/) | Same checks passed | Plain text, copy only |
| [CKEditor 5 official demo](https://ckeditor.com/ckeditor-5/demo/feature-rich/) | Same checks passed | Plain text, copy only |
| Inline TinyMCE | Synthetic DIV adapter fixture only; no actual vendor iframe configuration tested | Copy only |
| Tiptap | Shares the ProseMirror adapter; no separate live configuration tested | Copy only |
| Open shadow-root ordinary fields | Synthetic capture/private-ancestor/closed-root/forged-event tests passed | Copy only |
| Same-origin and cross-origin HTTP/HTTPS frames | Synthetic capture and origin/parent consent tests passed | Copy only |

Synthetic component tests establish the tested boundary, not a compatibility pass for an authenticated portal. Closed roots, opaque/about:blank/srcdoc frames and generic contenteditable remain unsupported. Formatting, files and editor document models are not recovered.

## Reproduce and contribute

Run `npm ci --ignore-scripts`, `npx playwright install chromium`, then `node tests/portals.mjs`, or dispatch Public portal compatibility. The harness contacts named public samples only and writes compact reports and synthetic screenshots. It never signs in, submits forms or solves access challenges. Sites and editor configurations change.

For real grant workflows use the [tester kit](tester-kit.md) and [native smoke-test worksheet](store/manual-smoke-test.md). Report vendor, extension/Chrome/OS versions, editor/frame type and passed/failed/unexercised steps. Never publish confidential application URLs, answers, profiles or session tokens.

Historical results remain available in [the 0.3.0 report](portal-results-0.3.0.json). See [precise compatibility boundaries](compatibility.md).
