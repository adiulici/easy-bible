import { describe, it, expect } from "vitest";
import {
  bookmarkId,
  isBookmarked,
  toggleBookmarkInList,
  removeBookmarkFromList,
  buildVerseSnippet,
  decidePendingJump,
  type Bookmark,
} from "@/utils/bookmarks";

/**
 * Builds a Bookmark with sane defaults for tests.
 * @param overrides - Partial fields to override on the base bookmark.
 * @returns A complete Bookmark object.
 */
function makeBookmark(overrides: Partial<Bookmark> = {}): Bookmark {
  return {
    book: "Geneza",
    chapter: 1,
    verse: "1",
    text: "La început...",
    createdAt: 1000,
    ...overrides,
  };
}

describe("bookmarkId", () => {
  it("builds a canonical pipe-delimited identity", () => {
    expect(bookmarkId("Geneza", 3, "16")).toBe("Geneza|3|16");
  });

  it("distinguishes different tuples", () => {
    expect(bookmarkId("Geneza", 3, "16")).not.toBe(bookmarkId("Geneza", 3, "17"));
    expect(bookmarkId("Geneza", 3, "16")).not.toBe(bookmarkId("Exodul", 3, "16"));
  });
});

describe("isBookmarked", () => {
  it("returns true when the tuple exists", () => {
    const list = [makeBookmark({ chapter: 3, verse: "16" })];
    expect(isBookmarked(list, "Geneza", 3, "16")).toBe(true);
  });

  it("returns false when the tuple is absent", () => {
    const list = [makeBookmark({ chapter: 3, verse: "16" })];
    expect(isBookmarked(list, "Geneza", 3, "17")).toBe(false);
    expect(isBookmarked([], "Geneza", 3, "16")).toBe(false);
  });
});

describe("toggleBookmarkInList", () => {
  it("adds a new bookmark by prepending (newest-first)", () => {
    const existing = makeBookmark({ verse: "1", createdAt: 1000 });
    const entry = makeBookmark({ verse: "2", createdAt: 2000 });
    const result = toggleBookmarkInList([existing], entry);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(entry);
    expect(result[1]).toEqual(existing);
  });

  it("removes an existing bookmark when toggled again", () => {
    const entry = makeBookmark({ verse: "1" });
    const result = toggleBookmarkInList([entry], makeBookmark({ verse: "1" }));
    expect(result).toHaveLength(0);
  });

  it("dedupes: toggling an existing tuple removes it rather than duplicating", () => {
    const entry = makeBookmark({ verse: "1", text: "old", createdAt: 1000 });
    // Same tuple but different text/createdAt -> should still remove, never dupe.
    const result = toggleBookmarkInList([entry], makeBookmark({ verse: "1", text: "new", createdAt: 9999 }));
    expect(result).toHaveLength(0);
  });

  it("returns a new array (immutability)", () => {
    const list = [makeBookmark({ verse: "1" })];
    const result = toggleBookmarkInList(list, makeBookmark({ verse: "2" }));
    expect(result).not.toBe(list);
    expect(list).toHaveLength(1);
  });

  it("keeps at most one bookmark per tuple across adds", () => {
    let list: Bookmark[] = [];
    list = toggleBookmarkInList(list, makeBookmark({ verse: "1" }));
    list = toggleBookmarkInList(list, makeBookmark({ verse: "1" }));
    expect(list).toHaveLength(0);
  });
});

describe("removeBookmarkFromList", () => {
  it("removes the matching tuple", () => {
    const list = [
      makeBookmark({ verse: "1" }),
      makeBookmark({ verse: "2" }),
    ];
    const result = removeBookmarkFromList(list, "Geneza", 1, "1");
    expect(result).toHaveLength(1);
    expect(result[0].verse).toBe("2");
  });

  it("returns a new array and leaves non-matches intact", () => {
    const list = [makeBookmark({ verse: "1" })];
    const result = removeBookmarkFromList(list, "Geneza", 1, "999");
    expect(result).not.toBe(list);
    expect(result).toHaveLength(1);
  });
});

describe("buildVerseSnippet", () => {
  it("strips HTML tags", () => {
    expect(buildVerseSnippet('<span class="s1">La început</span> a făcut')).toBe(
      "La început a făcut"
    );
  });

  it("collapses whitespace", () => {
    expect(buildVerseSnippet("La   \n  început")).toBe("La început");
  });

  it("leaves short text unchanged (no ellipsis)", () => {
    expect(buildVerseSnippet("Short verse")).toBe("Short verse");
  });

  it("truncates long text at a word boundary and appends an ellipsis", () => {
    const long =
      "La început a făcut Dumnezeu cerurile și pământul iar pământul era pustiu și gol";
    const result = buildVerseSnippet(long, 40);
    expect(result.length).toBeLessThanOrEqual(41); // 40 + ellipsis char
    expect(result.endsWith("…")).toBe(true);
    expect(result).not.toContain("  ");
    // Word-boundary: no partial word right before the ellipsis.
    const withoutEllipsis = result.slice(0, -1).trimEnd();
    expect(long.startsWith(withoutEllipsis)).toBe(true);
  });

  it("handles empty input", () => {
    expect(buildVerseSnippet("")).toBe("");
  });
});

describe("decidePendingJump", () => {
  const pending = { book: "Ioan", chapter: 3, verse: "16" };

  it("returns 'none' when no jump is pending", () => {
    expect(decidePendingJump(null, "Geneza", ["1", "2"])).toEqual({ action: "none" });
  });

  it("waits (does NOT complete) while content still holds the OLD book, even if that book has the chapter", () => {
    // Regression for C1: currentBook flips synchronously to the target, but the
    // content still belongs to the previous book. Gating on the content's real
    // book (contentBook) must NOT complete here, and must not falsely match just
    // because the old book happens to have a chapter "3".
    const decision = decidePendingJump(pending, "Geneza", ["1", "2", "3"]);
    expect(decision).toEqual({ action: "abandon" });
  });

  it("completes only once content actually IS the target book and the chapter is present", () => {
    const decision = decidePendingJump(pending, "Ioan", ["1", "2", "3"]);
    expect(decision).toEqual({ action: "complete", chapter: 3, verse: "16" });
  });

  it("abandons the jump when content loads for a DIFFERENT book (superseded navigation)", () => {
    // Regression for I1: a newer navigation loaded another book; the pending ref
    // must be cleared (abandon) so it can't permanently suppress later resets.
    const decision = decidePendingJump(pending, "Matei", ["1", "2", "3"]);
    expect(decision).toEqual({ action: "abandon" });
  });

  it("drops as stale when the target book loaded but the target chapter is absent", () => {
    const decision = decidePendingJump(pending, "Ioan", ["1", "2"]);
    expect(decision).toEqual({ action: "drop-stale" });
  });
});
