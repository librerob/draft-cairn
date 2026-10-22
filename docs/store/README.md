# Chrome Web Store assets

The original mark is a small cairn: three cream stones on deep green. It suggests a place to return to. These assets use the extension's existing identity; no Query Quiet artwork was copied. Like Query Quiet, the package keeps editable brand sources outside the extension ZIP.

| File | Use |
| --- | --- |
| `icon.svg` | Editable 128-unit vector master with a 96-unit mark and 16-unit transparent margins. |
| `icon-512.png` | Large transparent brand preview. |
| `../../extension/icons/128.png` | 128×128 PNG to include in the extension ZIP and use as the store icon. Its actual artwork is 96×96. |
| `../../extension/icons/16.png`, `32.png`, `48.png` | Small Chrome interface icons. Artwork fills these smaller canvases for legibility. |
| `small-promo.svg` | Editable promotional composition. System font rendering can vary by editor. |
| `small-promo.png` | Required small promotional image, 440×280. |
| `readme-header.svg` | Editable GitHub README banner, 960×250. |
| `../images/recovery.png`, `../images/library.png` | Real extension screenshots with synthetic fixture answers, 1280×800. The 0.1.1 patch changes only the store icon; the depicted interface and behavior are unchanged from the recorded 0.1.0 browser run. |
| `listing/listing.txt` (inside the kit) | Name, short description, and detailed description, generated from the canonical listing document. |
| `reviewer-instructions.txt` | Synthetic reviewer test steps, with no credentials required. |
| `manual-smoke-test.md` | Unmodified-package permission and clipboard checks still required before submission. |

Regenerate the raster icons with `python3 scripts/icons.py` (standard library only). The SVG master describes the same geometry; its editor's antialiasing may differ from the deterministic PNG generator. The supplied 440×280 raster tile was composed with local fonts; the SVG is an editable counterpart, not a byte-identical export recipe. All artwork is covered by the repository's MIT license.

`python3 scripts/package.py` builds both the install ZIP and a separate `draft-cairn-store-kit-<version>.zip`. Extract the kit first. **Upload only its inner `extension/draft-cairn-<version>.zip` as the extension package**, then upload the separate files under `listing/` into the corresponding listing-image fields. The outer kit contains documentation and is not an installable extension.

Google currently requires the extension icon, a small promotional image, and at least one screenshot. An optional 1400×560 marquee image is not required for submission and is not included. Requirements were rechecked on 22 October 2026 against the [official image guide](https://developer.chrome.com/docs/webstore/images). Prepared assets do not imply store approval or completed manual checks.
