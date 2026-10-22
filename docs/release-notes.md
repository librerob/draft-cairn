Draft Cairn 0.2.1 preview — a simpler interface with light and dark themes.

The workspace, toolbar popup and larger on-page editor now share a minimal Material-inspired design: clean sans-serif typography, rounded controls, quieter surfaces, and a restrained green accent.

- Appearance follows the system by default. Choose System, Light or Dark in Sites & settings. The preference is stored with encrypted local settings, applies across extension pages and supported-site editors, and remains available while the vault is locked.
- Dark mode covers fields, dialogs, status messages, menus and answer cards. The layout adapts to smaller windows. Reduced-motion and forced-color preferences are supported.
- Fonts and icons stay local. There are no new permissions, runtime dependencies, remote fonts or outbound connections.
- Encrypted library export now closes the passphrase form before starting the download, so immediately importing the file cannot be disrupted by the earlier dialog's close event.

Automatic answer encryption, the optional passphrase vault, locked capture, session-only drafts, site/field exclusions and library backups remain available. Forgotten vault or backup passphrases cannot be recovered. Clipboard history, readable exports, websites and a compromised live device remain outside vault protection.

Validation includes 15 unit groups, 53 real Chromium integration scenarios, text/control contrast checks for both palettes, static/manifest/asset checks and reproducible packaging. See docs/validation.md and validation-results-0.2.1.json for the exact tested commit and scenario count. There has been no independent security audit.

Native Chrome permission approval/denial/revocation, daily-use OS clipboard behavior and intended application portals still require supervised synthetic-data checks before Web Store submission. No store submission, payment or paid service has been activated.

Extract the extension ZIP, verify SHA256SUMS, and load its manifest folder using Chrome Developer mode / Load unpacked. For store preparation, extract the separate kit and upload only its inner extension ZIP as the package.
