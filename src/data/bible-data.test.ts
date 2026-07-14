import { describe, it, expect } from "vitest";
import books from "./books.json";
import VDC from "./bible.VDC.json";
import NTR from "./bible.NTR.json";
import type { Block } from "@/types/bible";

type Bundle = Record<string, Record<string, Block[]>>;
const bundles = { VDC, NTR } as unknown as Record<string, Bundle>;
const bookNames = books as string[];

describe.each(Object.keys(bundles))("bundled data guardrail: %s", (version) => {
  const bible = bundles[version];

  it("contains exactly the 66 canonical books, by Romanian name", () => {
    expect(Object.keys(bible)).toHaveLength(66);
    for (const name of bookNames) {
      expect(bible[name], `missing book "${name}"`).toBeDefined();
    }
  });

  it("has 1189 chapters in total", () => {
    const total = Object.values(bible).reduce(
      (sum, chapters) => sum + Object.keys(chapters).length,
      0
    );
    expect(total).toBe(1189);
  });

  it("only ever uses the three known block types", () => {
    const types = new Set<string>();
    for (const chapters of Object.values(bible)) {
      for (const blocks of Object.values(chapters)) {
        for (const block of blocks) {
          types.add(block.type);
        }
      }
    }
    expect([...types].sort()).toEqual(["heading", "paragraph", "poetry"]);
  });

  it("carries no leftover inline HTML markup in verse text", () => {
    const genesis = bible["Geneza"]["1"];
    const text = JSON.stringify(genesis);
    expect(text).not.toContain("<span");
  });
});

describe("known reference shapes (VDC)", () => {
  const vdc = bundles.VDC;
  it("renders Psalm 23 as poetry with a chapter-label heading", () => {
    const blocks = vdc["Psalmii"]["23"];
    expect(blocks[0]).toMatchObject({ type: "heading", level: "cl" });
    const poetry = blocks.find((b) => b.type === "poetry");
    expect(poetry, "Psalm 23 should contain a poetry block").toBeDefined();
    if (poetry && poetry.type === "poetry") {
      expect(poetry.lines[0]).toMatchObject({ verse: 1, indent: 1 });
    }
  });

  it("renders Genesis 1 with headings and a paragraph starting at verse 1", () => {
    const blocks = vdc["Geneza"]["1"];
    expect(blocks.some((b) => b.type === "heading")).toBe(true);
    const paragraph = blocks.find((b) => b.type === "paragraph");
    expect(paragraph, "Genesis 1 should contain a paragraph").toBeDefined();
    if (paragraph && paragraph.type === "paragraph") {
      expect(paragraph.verses[0].verse).toBe(1);
    }
  });
});
