# Commercial validation

22 October 2026 · hypotheses, not a sales forecast

## First customer and problem

Start with an independent grant writer or a two-to-five-person consultancy that repeatedly drafts long narrative answers in grant portals for several clients. The first test is whether they lose meaningful work often enough, distrust portal autosave enough, or reuse approved answers enough to change their workflow. Agencies handling high-sensitivity data may reject local capture; that is evidence to understand, not an objection to talk away.

The payable problem is time spent reconstructing an answer after session expiry, checking length before a portal truncates text, and finding the correct approved wording for a client. Do not assume those pains justify payment: many users can work effectively in a document and paste at the end.

## Alternatives reviewed

Sources checked 22 October 2026. These are a feature and license review, not a performance benchmark.

| Alternative | Relevant approach | License / status reviewed |
| --- | --- | --- |
| [Typio Form Recovery Reboot](https://github.com/tsukumijima/typio-form-recovery-reboot) | Automatic form-input history and recovery, including manual selection of a target. | Its [license.txt](https://github.com/tsukumijima/typio-form-recovery-reboot/blob/master/license.txt) uses CC BY-NC-ND 4.0, which restricts commercial use and sharing adaptations. Do not describe that license as open-source software licensing or reuse its code here. |
| [Form History Control II](https://github.com/stephanmahieu/formhistorycontrol-2) | General form-history viewing, management, and recovery. | [MIT](https://github.com/stephanmahieu/formhistorycontrol-2/blob/master/LICENSE). A direct open-source alternative. No source copied. |
| [Form Recover](https://formrecover.com/docs/) | Documentation describes immediate across-site capture and local recovery. | No reusable source license was established in the documentation reviewed; treat it as a product reference, not a source-code dependency. Security claims were not independently audited. |
| A local document or approved-text folder | Draft outside the portal and manually copy; often already sufficient. | Depends on the chosen editor. This is the strongest low-complexity substitute. |

Draft Cairn's specific deliverable is a deliberately opt-in workflow combining conservative long-answer recovery, selection-aware declared-limit paste interception, and a project-grouped answer library. Exact-origin capture, copy-only uncertain matches, and short default retention make the tradeoff visible. Individual features have precedents; no claim to be the first, unique, safer than every competitor, or universally compatible is warranted.

## Recruit ten relevant testers

Prepare a short invitation and a synthetic demo. The maintainer can manually recruit four independent grant writers, three small-agency staff, and three consultants who actually complete long portal forms. Use existing professional contacts and moderator-approved posts in grant-writing or consultancy communities. Ask about their last lost answer, actual portal, data-handling constraints, and existing workaround before showing the product. No automated outreach, scraping, posting, or contact has been performed.

Run a supervised synthetic loss-and-recovery task, then offer a two-week voluntary trial on data the participant is permitted to save. Ask them to keep their own private tally of protected sessions, successful recoveries, copy-only frustrations, time saved, and errors. Collect only counts and descriptions with consent, not answer text, credentials, or client identifiers. Do not add telemetry to infer usage silently.

## Test willingness to pay first

At the end, ask each tester to compare the extension with their actual workaround. Request a concrete next step: a scheduled paid workflow-setup session or a nonbinding written expression of interest for a clearly specified offer. A hypothetical “would you pay?” answer is weak evidence. Do not activate payments, take deposits, imply a plan exists, or charge without separate authorization.

Possible future hypotheses: £19–£29 once for a substantial personal upgrade under a paid-distribution model; £39–£59 annually only where continuing services or substantial ongoing value justify it. These are interview ranges, not available plans. Shared approved answers, administration, hosted backup, and support are separate team-service hypotheses. Validate permission, isolation, procurement, and support requirements before building them.

The free release includes every implemented local feature. MIT-licensed local code can be modified and redistributed; licensing is not a dependable technical paywall. Never promise lifetime hosting for a one-time purchase.

## Decision after ten testers

Treat the following as preselected decision thresholds, not achieved results:

- **Continue:** at least six complete repeated real workflows voluntarily, at least four report a meaningful avoided loss or repeated library use, at least three take a concrete willingness-to-pay step, and no observed wrong-field restoration or unaddressed sensitive capture occurs.
- **Change direction:** people value the library or paste editor but rarely need recovery, or most portals need bespoke matching. Narrow the product or supported portal set before adding hosted services.
- **Stop or pause product investment:** fewer than three return after onboarding, none takes a concrete payment-related step, most are satisfied with document-first drafting, or confidentiality requirements make the approach unacceptable.

Any wrong-field restore, loss caused by the extension, or unexpected sensitive capture blocks expanding deployment until investigated and fixed. The first ten testers provide directional evidence, not proof of market size or recurring revenue.
