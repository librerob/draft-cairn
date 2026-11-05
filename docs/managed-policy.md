# Organization policy

Draft Cairn 0.4.0 reads Chrome `storage.managed` using the packaged managed schema. This is an optional local restriction mechanism, not a paid team service or cloud administration product.

```json
{
  "AllowedOrigins": ["https://your-organization.example"],
  "MaxRetentionDays": 7
}
```

`AllowedOrigins` is an optional list of up to 80 exact HTTP/HTTPS origins, with no paths, wildcards or login details. When absent, users can choose sites normally. An explicitly empty list denies all website capture. Both the containing page and any embedded frame origin must be allowed. Invalid entries are ignored, leaving the list restrictive. This policy does not request Chrome permissions or enable any site automatically. Existing settings for newly disallowed sites are removed during maintenance; existing saved drafts are retained until expiry or deletion.

`MaxRetentionDays` is one of 1, 3, 7, 14 or 30. It caps new recovery records and shortens existing recovery expiry during policy-change/startup/hourly maintenance. Site/global retention controls cannot exceed it. A longer future policy does not resurrect expired records. The one-hour original-paste cap and storage eviction still apply. Explicit library answers remain until deleted; this policy is not an organization-wide data retention guarantee.

Deploy the values through your organization's supported Chrome extension policy channel, using the actual published extension ID. Follow [Chrome's managed-storage documentation](https://developer.chrome.com/docs/extensions/reference/manifest/storage). Do not paste policy settings into a website or grant all-site host access merely to deploy these restrictions.

Tests simulate managed values through Chrome's managed-storage reader and exercise capture/API enforcement. Native managed Chrome deployment and OS-specific registry/plist delivery remain unverified. Test with synthetic answers in a managed pilot profile before rollout.
