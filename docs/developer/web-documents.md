# Documents

`Ignis.Web` serves markdown as pages, from two **collections**.

| Collection | Source                                                        | Served at       |
| ---------- | ------------------------------------------------------------- | --------------- |
| `pages`    | A directory mounted into the container at runtime             | `/pages/<slug>` |
| `docs`     | This repository's `docs/`, gathered before the image is built | `/docs/<path>`  |

## The `pages` collection

Could be used for documents like terms of use, privacy policy, accessibility statement.

### Configuration

| Variable                 | Purpose                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `IGNIS_WEB_CONTENT_DIR`  | Directory of markdown documents. Unset disables the feature; `/pages/*` then 404s. |
| `IGNIS_WEB_FOOTER_LINKS` | Footer links as JSON — see below. Hrefs may be internal or external.               |

```json
[
  { "href": "/pages/terms", "label": { "en": "Terms of use", "nb": "Vilkår" } },
  {
    "href": "/pages/privacy",
    "label": { "en": "Privacy", "nb": "Personvern" }
  },
  { "href": "https://github.com/incendilabs/ignis", "label": "GitHub" }
]
```

Give an href per locale only when the destination genuinely differs — an off-site page
that has its own translation:

```json
{
  "href": {
    "en": "https://example.com/help",
    "nb": "https://example.no/hjelp"
  },
  "label": { "en": "Help", "nb": "Hjelp" }
}
```

Pages this app serves share one URL across languages by design: a document's slug comes
from its base-locale version, so a translation cannot rename it.

Footer links are configuration, not message-catalogue entries: which documents exist is
a property of the deployment, not of the app.

### Writing a document

```markdown
---
title: Terms of use
slug: terms
updated: 2026-08-04
---

Describe the terms of use here.
```

- `title` — the page heading and `<title>`. Defaults to the filename.
- `slug` — the URL segment. Defaults to the filename; lowercase words joined by hyphens.
- `updated` — shown under the heading, formatted for the reader's locale.

Documents link to each other **by filename** — `[privacy policy](privacy-policy.md)` — so
the content also reads on disk and on GitHub. The app rewrites those links to the page
URL.

### Languages

A document's locale comes from a filename suffix or from a locale-named subdirectory —
both work, pick one:

```text
content/terms-of-use.md        # no locale: serves every language
content/terms-of-use.nb.md     # Norwegian
content/nb/terms-of-use.md     # Norwegian, the other way
```

### Deploying the content

Mount the directory and point `IGNIS_WEB_CONTENT_DIR` at it. In Kubernetes that means a
ConfigMap built from the content repository.

**A ConfigMap's keys are flat.** `--from-file=<dir>` takes only the regular files directly
in that directory, so a directory-per-locale repository needs one ConfigMap per locale,
each mounted at its own path. Pointing at both locale directories at once is not an
option: `terms-of-use.md` would be the same key twice.

```yaml
web:
  extraEnv:
    - name: IGNIS_WEB_CONTENT_DIR
      value: /app/content
    - name: IGNIS_WEB_FOOTER_LINKS
      value: |
        [
          { "href": "/pages/terms", "label": { "en": "Terms of use", "nb": "Vilkår" } },
          { "href": "/pages/privacy", "label": { "en": "Privacy", "nb": "Personvern" } }
        ]
  extraVolumes:
    - name: content-en
      configMap: { name: ignis-content-en }
    - name: content-nb
      configMap: { name: ignis-content-nb }
  # Sibling mount points; Kubernetes creates /app/content itself.
  extraVolumeMounts:
    - name: content-en
      mountPath: /app/content/en
      readOnly: true
    - name: content-nb
      mountPath: /app/content/nb
      readOnly: true
```

## The `docs` collection

This repository's own documentation, gathered by
[`docs.config.ts`](../../src/Ignis.Web/docs.config.ts) and served at `/docs`.

```sh
npm run docs:collect        # in src/Ignis.Web
```
