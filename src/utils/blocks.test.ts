import { describe, it, expect } from "vitest";
import {
  chapterVerseNumbers,
  firstVerseNumber,
  lastVerseNumber,
  findVerseText,
  flattenVerses,
} from "./blocks";
import type { Block, BookContent } from "@/types/bible";

const poetryChapter: Block[] = [
  { type: "heading", level: "cl", text: "PSALMUL 23" },
  { type: "heading", level: "d", text: "O cântare a lui David" },
  {
    type: "poetry",
    lines: [
      { verse: 1, indent: 1, text: "Domnul este Păstorul meu:" },
      { verse: 1, indent: 1, text: "nu voi duce lipsă de nimic." },
      { verse: 2, indent: 1, text: "El mă paște în pășuni verzi" },
      { verse: 2, indent: 1, text: "și mă duce la ape de odihnă;" },
    ],
  },
];

const proseChapter: Block[] = [
  { type: "heading", level: "s1", text: "Facerea lumii" },
  { type: "paragraph", verses: [{ verse: 1, text: "La început..." }] },
  {
    type: "paragraph",
    verses: [
      { verse: 2, text: "Pământul era pustiu..." },
      { verse: 3, text: "Dumnezeu a zis..." },
    ],
  },
];

const withBlankLines: Block[] = [
  {
    type: "poetry",
    lines: [
      { verse: 1, indent: 1, text: "Prima linie." },
      { verse: null, indent: 0, text: "" },
      { verse: 2, indent: 2, text: "A doua linie." },
    ],
  },
];

describe("chapterVerseNumbers", () => {
  it("returns distinct verse numbers in reading order for poetry", () => {
    expect(chapterVerseNumbers(poetryChapter)).toEqual(["1", "2"]);
  });

  it("returns distinct verse numbers in reading order across paragraphs", () => {
    expect(chapterVerseNumbers(proseChapter)).toEqual(["1", "2", "3"]);
  });

  it("skips headings and blank (null-verse) poetry lines", () => {
    expect(chapterVerseNumbers(withBlankLines)).toEqual(["1", "2"]);
  });

  it("returns an empty array for an empty chapter", () => {
    expect(chapterVerseNumbers([])).toEqual([]);
  });
});

describe("firstVerseNumber / lastVerseNumber", () => {
  it("finds the first and last verse of a poetry chapter", () => {
    expect(firstVerseNumber(poetryChapter)).toBe("1");
    expect(lastVerseNumber(poetryChapter)).toBe("2");
  });

  it("finds the first and last verse of a prose chapter", () => {
    expect(firstVerseNumber(proseChapter)).toBe("1");
    expect(lastVerseNumber(proseChapter)).toBe("3");
  });

  it("returns null when there are no verses", () => {
    expect(firstVerseNumber([{ type: "heading", level: "s1", text: "x" }])).toBeNull();
    expect(lastVerseNumber([])).toBeNull();
  });
});

describe("findVerseText", () => {
  it("joins multiple poetry lines of the same verse", () => {
    expect(findVerseText(poetryChapter, "1")).toBe("Domnul este Păstorul meu: nu voi duce lipsă de nimic.");
  });

  it("returns a single paragraph verse's text", () => {
    expect(findVerseText(proseChapter, "3")).toBe("Dumnezeu a zis...");
  });

  it("returns an empty string when the verse is absent", () => {
    expect(findVerseText(proseChapter, "99")).toBe("");
  });
});

describe("flattenVerses", () => {
  it("flattens all chapters into ordered {chapter, verse} entries", () => {
    const content: BookContent = { "1": proseChapter, "2": poetryChapter };
    expect(flattenVerses(content)).toEqual([
      { chapter: 1, verse: "1" },
      { chapter: 1, verse: "2" },
      { chapter: 1, verse: "3" },
      { chapter: 2, verse: "1" },
      { chapter: 2, verse: "2" },
    ]);
  });

  it("returns an empty array for empty content", () => {
    expect(flattenVerses({})).toEqual([]);
  });
});
