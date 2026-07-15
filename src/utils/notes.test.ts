import { describe, it, expect } from "vitest";
import {
  noteVerseId,
  notesForVerse,
  truncateNoteBody,
  replaceNoteId,
  applyNoteEdit,
  removeNoteById,
} from "@/utils/notes";
import type { Note } from "@/types/notes";

/**
 * Builds a Note with sane defaults for tests.
 * @param overrides - Partial fields to override on the base note.
 * @returns A complete Note object.
 */
function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 1,
    book: "Geneza",
    chapter: 1,
    verse: "1",
    body: "First note",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: null,
    ...overrides,
  };
}

describe("noteVerseId", () => {
  it("builds a canonical pipe-delimited identity", () => {
    expect(noteVerseId("Geneza", 3, "16")).toBe("Geneza|3|16");
  });
});

describe("notesForVerse", () => {
  it("filters to the matching (book, chapter, verse) tuple, preserving order", () => {
    const a = makeNote({ id: 1, verse: "1", body: "a" });
    const b = makeNote({ id: 2, verse: "1", body: "b" });
    const c = makeNote({ id: 3, verse: "2", body: "c" });
    expect(notesForVerse([a, b, c], "Geneza", 1, "1")).toEqual([a, b]);
  });

  it("returns an empty array when there are no matches", () => {
    expect(notesForVerse([makeNote()], "Geneza", 1, "999")).toEqual([]);
  });
});

describe("truncateNoteBody", () => {
  it("collapses newlines and whitespace", () => {
    expect(truncateNoteBody("Line one\nLine   two")).toBe("Line one Line two");
  });

  it("leaves short text unchanged (no ellipsis)", () => {
    expect(truncateNoteBody("Short note")).toBe("Short note");
  });

  it("truncates long text at a word boundary and appends an ellipsis", () => {
    const long =
      "This is a fairly long note body that should get truncated at some point in the middle";
    const result = truncateNoteBody(long, 40);
    expect(result.length).toBeLessThanOrEqual(41);
    expect(result.endsWith("…")).toBe(true);
    const withoutEllipsis = result.slice(0, -1).trimEnd();
    expect(long.startsWith(withoutEllipsis)).toBe(true);
  });

  it("handles empty input", () => {
    expect(truncateNoteBody("")).toBe("");
  });
});

describe("replaceNoteId", () => {
  it("replaces the note matching the optimistic id", () => {
    const optimistic = makeNote({ id: -1000, body: "draft" });
    const confirmed = makeNote({ id: 42, body: "draft" });
    expect(replaceNoteId([optimistic], -1000, confirmed)).toEqual([confirmed]);
  });

  it("leaves the list unchanged when the id is absent", () => {
    const note = makeNote({ id: 1 });
    expect(replaceNoteId([note], -999, makeNote({ id: 2 }))).toEqual([note]);
  });

  it("returns a new array (immutability)", () => {
    const list = [makeNote({ id: -1 })];
    const result = replaceNoteId(list, -1, makeNote({ id: 5 }));
    expect(result).not.toBe(list);
  });
});

describe("applyNoteEdit", () => {
  it("updates body and updatedAt on the matching note", () => {
    const note = makeNote({ id: 1, body: "old", updatedAt: null });
    const result = applyNoteEdit([note], 1, "new", "2026-02-01T00:00:00.000Z");
    expect(result[0].body).toBe("new");
    expect(result[0].updatedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("leaves non-matching notes untouched", () => {
    const a = makeNote({ id: 1, body: "a" });
    const b = makeNote({ id: 2, body: "b" });
    const result = applyNoteEdit([a, b], 1, "changed", "2026-02-01T00:00:00.000Z");
    expect(result[1]).toEqual(b);
  });
});

describe("removeNoteById", () => {
  it("removes the matching note", () => {
    const a = makeNote({ id: 1 });
    const b = makeNote({ id: 2 });
    expect(removeNoteById([a, b], 1)).toEqual([b]);
  });

  it("returns a new array and leaves non-matches intact", () => {
    const list = [makeNote({ id: 1 })];
    const result = removeNoteById(list, 999);
    expect(result).not.toBe(list);
    expect(result).toHaveLength(1);
  });
});
