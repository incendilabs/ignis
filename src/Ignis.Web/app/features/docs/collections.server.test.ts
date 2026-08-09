/*
 * Copyright (c) 2026, Incendi <info@incendi.no>
 *
 * SPDX-License-Identifier: BSD-3-Clause
 */

import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resetCollectionCache } from "./collections.server";
import { documentHref } from "./collections.shared";
import { getDocument, getDocumentTree } from "./documents.server";

let dir: string;

/** Writes a document, creating its locale subdirectory if it has one. */
async function write(file: string, source: string): Promise<void> {
  const target = path.join(dir, file);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, source, "utf8");
}

function doc(frontmatter: Record<string, string>, body: string): string {
  const lines = Object.entries(frontmatter).map(([key, value]) => `${key}: ${value}`);
  return `---\n${lines.join("\n")}\n---\n${body}\n`;
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "ignis-content-"));
  process.env.IGNIS_WEB_CONTENT_DIR = dir;
  resetCollectionCache();
});

afterEach(async () => {
  delete process.env.IGNIS_WEB_CONTENT_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe("the pages collection", () => {
  it("serves a document under the slug from its frontmatter", async () => {
    await write("terms-of-use.md", doc({ title: "Terms of use", slug: "terms" }, "Hello."));

    expect(await getDocument("pages", "terms", "en")).toMatchObject({
      title: "Terms of use",
      markdown: "Hello.\n",
    });
  });

  it("falls back to the filename when the frontmatter sets no slug", async () => {
    await write("accessibility.md", doc({ title: "Accessibility" }, "Body."));

    expect(await getDocument("pages", "accessibility", "en")).toMatchObject({
      title: "Accessibility",
    });
  });

  it("uses the filename as the title when the frontmatter sets none", async () => {
    await write("house-rules.md", "Body.\n");

    expect(await getDocument("pages", "house-rules", "en")).toMatchObject({
      title: "house-rules",
    });
  });

  it("keeps `updated` as authored", async () => {
    await write("terms.md", doc({ title: "T", updated: "2026-08-04" }, "Body."));

    expect(await getDocument("pages", "terms", "en")).toMatchObject({ updated: "2026-08-04" });
  });

  it("returns null for an unknown slug", async () => {
    expect(await getDocument("pages", "nope", "en")).toBeNull();
  });

  it("returns null when no content directory is configured", async () => {
    delete process.env.IGNIS_WEB_CONTENT_DIR;
    resetCollectionCache();

    expect(await getDocument("pages", "terms", "en")).toBeNull();
  });

  it.each(["../../etc/passwd", "..", "terms/../../x", "Terms"])(
    "refuses the unsafe slug %j",
    async (slug) => {
      await write("terms.md", doc({ title: "T" }, "Body."));

      expect(await getDocument("pages", slug, "en")).toBeNull();
    },
  );

  it("ignores files that are not markdown", async () => {
    await write("logo.png", "not markdown");

    expect(await getDocument("pages", "logo", "en")).toBeNull();
  });

  it("builds a tree from the documents it holds", async () => {
    await write("terms.md", doc({ title: "Terms" }, "Body."));
    await write("privacy.md", doc({ title: "Privacy" }, "Body."));

    expect((await getDocumentTree("pages", "en")).map((node) => node.title).sort()).toEqual([
      "Privacy",
      "Terms",
    ]);
  });
});

describe("languages", () => {
  it("serves the suffixed translation for its locale", async () => {
    await write("terms.md", doc({ title: "Terms" }, "English."));
    await write("terms.nb.md", doc({ title: "Vilkår" }, "Norsk."));

    expect(await getDocument("pages", "terms", "nb")).toMatchObject({
      title: "Vilkår",
      markdown: "Norsk.\n",
      locale: "nb",
    });
    expect(await getDocument("pages", "terms", "en")).toMatchObject({ markdown: "English.\n" });
  });

  it("serves a translation placed in a locale directory", async () => {
    await write("en/terms.md", doc({ title: "Terms" }, "English."));
    await write("nb/terms.md", doc({ title: "Vilkår" }, "Norsk."));

    expect(await getDocument("pages", "terms", "nb")).toMatchObject({ markdown: "Norsk.\n" });
    expect(await getDocument("pages", "terms", "en")).toMatchObject({ markdown: "English.\n" });
  });

  it("falls back to the base locale when a translation is missing", async () => {
    await write("terms.md", doc({ title: "Terms" }, "English."));
    await write("privacy.nb.md", doc({ title: "Personvern" }, "Norsk."));

    expect(await getDocument("pages", "terms", "nb")).toMatchObject({
      markdown: "English.\n",
      locale: "en",
      multilingual: true,
    });
  });

  it("is not multilingual when every document is in one language", async () => {
    await write("terms.md", doc({ title: "Terms" }, "English."));

    expect(await getDocument("pages", "terms", "nb")).toMatchObject({
      locale: "en",
      multilingual: false,
    });
  });

  it("takes the slug each translation declares, so they stay one document", async () => {
    await write("en/terms-of-use.md", doc({ title: "Terms", slug: "terms" }, "English."));
    await write("nb/terms-of-use.md", doc({ title: "Vilkår", slug: "terms" }, "Norsk."));

    expect(await getDocument("pages", "terms", "nb")).toMatchObject({ markdown: "Norsk.\n" });
    expect(await getDocument("pages", "terms-of-use", "nb")).toBeNull();
  });

  it("ignores directories that are not locales", async () => {
    await write("drafts/secret.md", doc({ title: "Secret" }, "Body."));

    expect(await getDocument("pages", "secret", "en")).toBeNull();
  });
});

describe("links between documents", () => {
  it("maps each document's path to its page, for the served locale", async () => {
    await write("en/terms-of-use.md", doc({ title: "Terms", slug: "terms" }, "English."));
    await write("nb/terms-of-use.md", doc({ title: "Vilkår", slug: "terms" }, "Norsk."));
    await write("en/privacy-policy.md", doc({ title: "Privacy", slug: "privacy" }, "Body."));

    const english = await getDocument("pages", "privacy", "en");
    expect(english?.source).toBe("en/privacy-policy.md");
    expect(english?.pageBySource["en/terms-of-use.md"]).toBe(documentHref("pages", "/terms"));

    // The Norwegian reader's map points at the Norwegian file, so a link
    // written the same way in both documents resolves per language.
    const norwegian = await getDocument("pages", "terms", "nb");
    expect(norwegian?.pageBySource["nb/terms-of-use.md"]).toBe(documentHref("pages", "/terms"));
  });
});

describe("the docs collection", () => {
  /** A manifest the way `docs:collect` writes one, plus the files it points at. */
  async function collect(
    pages: { slug: string; title: string; source: string; body: string; }[],
    sourceUrl?: string,
  ): Promise<void> {
    const manifest = {
      version: 1,
      pages: pages.map((page) => ({ ...page, file: page.source, frontmatter: {} })),
      ...(sourceUrl === undefined ? {} : { sourceUrl }),
    };
    await write("manifest.json", JSON.stringify(manifest));
    for (const page of pages) await write(page.source, page.body);
  }

  beforeEach(() => {
    delete process.env.IGNIS_WEB_CONTENT_DIR;
    process.env.IGNIS_WEB_DOCS_DIR = dir;
    resetCollectionCache();
  });

  afterEach(() => {
    delete process.env.IGNIS_WEB_DOCS_DIR;
  });

  it("serves a page from the manifest", async () => {
    await collect([
      { slug: "/developer/validation", title: "Validation", source: "developer/validation.md", body: "Body.\n" },
    ]);

    expect(await getDocument("docs", "/developer/validation")).toMatchObject({
      title: "Validation",
      markdown: "Body.\n",
    });
  });

  it("nests the tree by slug", async () => {
    await collect([
      { slug: "/developer/validation", title: "Validation", source: "a.md", body: "x" },
      { slug: "/developer/profiles/norway", title: "Norway", source: "b.md", body: "x" },
    ]);

    const tree = await getDocumentTree("docs");
    expect(tree.map((node) => node.title)).toEqual(["Developer"]);
    expect(tree[0].children.map((child) => child.title)).toEqual(["Validation", "Profiles"]);
  });

  it("carries the forge template for files it doesn't publish", async () => {
    await collect(
      [{ slug: "/testing", title: "Testing", source: "testing.md", body: "x" }],
      "https://example.com/blob/main/{path}",
    );

    expect(await getDocument("docs", "/testing")).toMatchObject({
      sourceUrl: "https://example.com/blob/main/{path}",
    });
  });

  it("is absent when the build carries no manifest", async () => {
    expect(await getDocument("docs", "/testing")).toBeNull();
    expect(await getDocumentTree("docs")).toEqual([]);
  });

  it("degrades rather than throwing when the manifest is not valid JSON", async () => {
    await write("manifest.json", "{ not json");

    expect(await getDocument("docs", "/testing")).toBeNull();
    expect(await getDocumentTree("docs")).toEqual([]);
  });
});

