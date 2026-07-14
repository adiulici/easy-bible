import { findBestMatch } from "@/utils/fuzzySearch";

/** A resolved target for the "go to book" command: a book, chapter, and optional verse. */
export interface BookNavigationTarget {
  /** Canonical book name (from the books list), not the raw user input. */
  book: string;
  /** Chapter number; defaults to 1 when the input names only a book. */
  chapter: number;
  /** Verse number key, present only when the input included ":<verse>". */
  verse?: string;
}

/** Matches an optional trailing "<chapter>" or "<chapter>:<verse>" at the end of the input. */
const TRAILING_CHAPTER_VERSE = /^(.+?)\s+(\d+)(?::(\d+))?$/;

/**
 * Parses "go to book" modal input of the form "Book", "Book Chapter", or
 * "Book Chapter:Verse" into a navigation target, fuzzy-matching the book name
 * against the known books list. The trailing-chapter regex is lazy so it finds
 * the earliest split point whose remainder is purely numeric, which correctly
 * leaves a numbered book's own leading digit (e.g. "1 Ioan") inside the book
 * part instead of misreading it as a chapter.
 * @param input - Raw text typed by the user.
 * @param books - List of known canonical book names.
 * @returns The resolved target, or null if no book name matches.
 */
export function parseBookNavigationInput(
  input: string,
  books: string[]
): BookNavigationTarget | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(TRAILING_CHAPTER_VERSE);
  const bookPart = match ? match[1] : trimmed;
  const chapter = match ? parseInt(match[2], 10) : 1;
  const verse = match?.[3];

  const matchedBook = findBestMatch(bookPart, books);
  if (!matchedBook) {
    return null;
  }

  return verse ? { book: matchedBook, chapter, verse } : { book: matchedBook, chapter };
}

/**
 * Reports whether the input already ends in a "<chapter>" or "<chapter>:<verse>"
 * token, so callers (autocomplete) can tell a bare book name still in progress
 * from one the user has moved past by typing a chapter.
 * @param input - Raw text typed by the user.
 * @returns True if the input ends in a chapter (optionally chapter:verse) token.
 */
export function hasChapterSuffix(input: string): boolean {
  return TRAILING_CHAPTER_VERSE.test(input.trim());
}
