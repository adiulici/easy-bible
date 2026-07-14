import { describe, it, expect } from "vitest";
import { parseBookNavigationInput, hasChapterSuffix } from "@/utils/bookNavigation";

const books = [
  "Geneza",
  "Ioan",
  "1 Ioan",
  "2 Ioan",
  "3 Ioan",
  "1 Corinteni",
];

describe("parseBookNavigationInput", () => {
  it("resolves a bare book name to chapter 1 with no verse", () => {
    expect(parseBookNavigationInput("Geneza", books)).toEqual({
      book: "Geneza",
      chapter: 1,
    });
  });

  it("resolves a book + chapter with no verse", () => {
    expect(parseBookNavigationInput("Geneza 3", books)).toEqual({
      book: "Geneza",
      chapter: 3,
    });
  });

  it("resolves a book + chapter + verse", () => {
    expect(parseBookNavigationInput("Geneza 3:5", books)).toEqual({
      book: "Geneza",
      chapter: 3,
      verse: "5",
    });
  });

  it("fuzzy-matches a partial book name before a chapter", () => {
    expect(parseBookNavigationInput("gen 3:5", books)).toEqual({
      book: "Geneza",
      chapter: 3,
      verse: "5",
    });
  });

  it("keeps a numbered book's leading digit out of the chapter parse", () => {
    expect(parseBookNavigationInput("1 Ioan 3:5", books)).toEqual({
      book: "1 Ioan",
      chapter: 3,
      verse: "5",
    });
  });

  it("resolves a bare numbered book name to chapter 1", () => {
    expect(parseBookNavigationInput("1 Ioan", books)).toEqual({
      book: "1 Ioan",
      chapter: 1,
    });
  });

  it("returns null when no book matches", () => {
    expect(parseBookNavigationInput("Xyzzy 3:5", books)).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseBookNavigationInput("   ", books)).toBeNull();
  });

  it("does no range validation on a degenerate chapter number", () => {
    // Downstream (page.tsx) treats an out-of-range chapter as a graceful
    // no-op, same as any other invalid chapter jump - the parser itself is
    // not responsible for range-checking.
    expect(parseBookNavigationInput("Geneza 0", books)).toEqual({
      book: "Geneza",
      chapter: 0,
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseBookNavigationInput("  Geneza 3:5  ", books)).toEqual({
      book: "Geneza",
      chapter: 3,
      verse: "5",
    });
  });
});

describe("hasChapterSuffix", () => {
  it("is false for a bare book name in progress", () => {
    expect(hasChapterSuffix("Gen")).toBe(false);
    expect(hasChapterSuffix("1 Ioan")).toBe(false);
  });

  it("is true once a chapter is typed", () => {
    expect(hasChapterSuffix("Geneza 3")).toBe(true);
  });

  it("is true once a chapter:verse is typed", () => {
    expect(hasChapterSuffix("Geneza 3:5")).toBe(true);
  });
});
