/**
 * Pure, framework-free helpers for the verse-notes feature. Mirrors the shape
 * of src/utils/bookmarks.ts: identity keyed by (book, chapter, verse), all list
 * operations are immutable (return new arrays) so React state updates stay safe.
 */
import type { Note } from "@/types/notes";

/**
 * Builds the identity for a verse's notes (not a single note - multiple notes
 * can share this key).
 * @param book - Book name.
 * @param chapter - Chapter number.
 * @param verse - Verse number key.
 * @returns Pipe-delimited identity string "<book>|<chapter>|<verse>".
 */
export function noteVerseId(book: string, chapter: number, verse: string): string {
  return `${book}|${chapter}|${verse}`;
}

/**
 * Filters notes down to a single verse, preserving list order (callers keep
 * `notes` sorted oldest-first, matching the API's created_at ascending order).
 * @param list - Full notes list.
 * @param book - Book name to match.
 * @param chapter - Chapter number to match.
 * @param verse - Verse number key to match.
 * @returns Notes for that verse, oldest-first.
 */
export function notesForVerse(list: Note[], book: string, chapter: number, verse: string): Note[] {
  return list.filter((n) => n.book === book && n.chapter === chapter && n.verse === verse);
}

/**
 * Plain-text truncation for note bodies: collapses whitespace/newlines and
 * truncates at a word boundary (with an ellipsis) if too long. Unlike
 * buildVerseSnippet, no HTML stripping - note bodies are always plain text.
 * @param body - Raw note body (may contain newlines).
 * @param maxLen - Maximum snippet length before truncation (default 80).
 * @returns Single-line plain-text snippet, truncated with "…" when it exceeds maxLen.
 */
export function truncateNoteBody(body: string, maxLen = 80): string {
  const plain = body.replace(/\s+/g, " ").trim();
  if (plain.length <= maxLen) {
    return plain;
  }
  const hardCut = plain.slice(0, maxLen);
  const lastSpace = hardCut.lastIndexOf(" ");
  const truncated = lastSpace > 0 ? hardCut.slice(0, lastSpace) : hardCut;
  return `${truncated.trimEnd()}…`;
}

/**
 * Replaces a note by id (the local, optimistic id) with the server-confirmed
 * note (which carries the real database id). No-op if the old id isn't present.
 * @param list - Current notes list.
 * @param oldId - The optimistic id to replace.
 * @param confirmed - The server-returned note to replace it with.
 * @returns A new notes list with the substitution applied.
 */
export function replaceNoteId(list: Note[], oldId: number, confirmed: Note): Note[] {
  return list.map((n) => (n.id === oldId ? confirmed : n));
}

/**
 * Updates a note's body (and updatedAt) in place, immutably.
 * @param list - Current notes list.
 * @param id - Id of the note to update.
 * @param body - New body text.
 * @param updatedAt - ISO timestamp to stamp on the update.
 * @returns A new notes list with the matching note updated.
 */
export function applyNoteEdit(list: Note[], id: number, body: string, updatedAt: string): Note[] {
  return list.map((n) => (n.id === id ? { ...n, body, updatedAt } : n));
}

/**
 * Removes the note matching an id, if present.
 * @param list - Current notes list.
 * @param id - Id of the note to remove.
 * @returns A new notes list without the matching note.
 */
export function removeNoteById(list: Note[], id: number): Note[] {
  return list.filter((n) => n.id !== id);
}
