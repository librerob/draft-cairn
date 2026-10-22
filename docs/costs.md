# Costs and publishing requirements

Verified 22 October 2026. Currency amounts below are source-backed where stated; future operating costs are categories, not quotes.

## Current release

- **Recurring application infrastructure: £0 required.** The extension has no server, hosted database, paid API, remote model, subscription, or domain dependency. It uses the user's existing browser and device storage.
- **Public source and CI:** GitHub's [Actions billing documentation](https://docs.github.com/en/billing/concepts/product-billing/github-actions) states that standard GitHub-hosted runners for public repositories are free. This project uses `ubuntu-24.04`, brief jobs, and 14-day artifact retention. Larger runners and other paid features are not activated. Applicable platform allowances and policies still apply.
- **Chrome Web Store:** Google's [registration instructions](https://developer.chrome.com/docs/webstore/register) require developer registration and a one-time registration fee. Google's [publisher-roles announcement](https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard) explicitly gives the fee as **US$5**. This is a registration fee, not a recurring extension-hosting subscription. Actual checkout currency, tax, and amount should be confirmed in the dashboard before payment; no GBP conversion is asserted. No registration or payment was performed.
- **Domain:** optional. GitHub can host source, documentation, issue tracking, release downloads, and a public privacy-policy URL. The extension itself needs no website server. No domain was registered.
- **Dependencies:** no runtime packages; test tooling is free software. Development, browser testing, and maintenance still require human time.

## Remaining store requirements

Google requires a developer account, agreement to store policies, publisher profile and verified email, a valid extension ZIP, listing and image assets, accurate purpose/permission/privacy disclosures, distribution settings, and review. Google's [publish guide](https://developer.chrome.com/docs/webstore/publish), [account setup](https://developer.chrome.com/docs/webstore/set-up-account), and [image requirements](https://developer.chrome.com/docs/webstore/images) are the authoritative sources. Two-step verification and any account-specific identity/contact verification must be completed in the dashboard before submission; [two-step verification policy](https://developer.chrome.com/docs/webstore/program-policies/two-step-verification). Account eligibility, regional/trader disclosures, and checklist requirements can change. Do not assume review approval or a particular review time.

The prepared [listing/checklist](chrome-web-store.md) is not a submission. The owner must separately authorize any payment or submission. Loading the unpacked GitHub release for development does not require store registration.

## Future cost categories, if demand supports services

Hosted sync would add authentication, tenant isolation, application compute, storage, network transfer, monitoring without answer contents, encryption/key management, and incident response. Backups add storage versions, restore testing, retention controls, and possible recovery egress. Payment processing adds transaction fees, taxes, refunds, chargebacks, and accounting; no exact rates are quoted without a chosen provider and market. Support adds staff time, secure issue handling, accessibility and browser compatibility work, dependency updates, and customer onboarding.

Get current provider quotes and model real usage before committing. Separate infrastructure spend from support and engineering time. Do not promise lifetime hosting for a one-time payment or assume open-source distribution can enforce a local paywall. No paid dependency or service may be activated without the owner's explicit authorization.
