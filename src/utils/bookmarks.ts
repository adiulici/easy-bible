/**
 * Pure, framework-free helpers for the verse-bookmarks feature. All list
 * operations are immutable (return new arrays) so React state updates stay safe.
 */

export interface Bookmark {
  /** Book name, e.g. "Geneza". */
  book: string;
  /** Chapter number, e.g. 3. */
  chapter: number;
  /** Verse "number" key (verses are string-keyed), e.g. "16". */
  verse: string;
  /** Plain-text snippet captured at creation time. */
  text: string;
  /** Creation timestamp (ms) used for newest-first ordering. */
  createdAt: number;
}

/**
 * Builds the canonical dedupe identity for a verse.
 * @param book - Book name.
 * @param chapter - Chapter number.
 * @param verse - Verse number key.
 * @returns Pipe-delimited identity string "<book>|<chapter>|<verse>".
 */
export function bookmarkId(book: string, chapter: number, verse: string): string {
  return `${book}|${chapter}|${verse}`;
}

/**
 * Reports whether a verse is already bookmarked, by (book, chapter, verse) tuple.
 * @param list - Current bookmark list.
 * @param book - Book name to match.
 * @param chapter - Chapter number to match.
 * @param verse - Verse number key to match.
 * @returns True if a bookmark with the matching tuple exists.
 */
export function isBookmarked(
  list: Bookmark[],
  book: string,
  chapter: number,
  verse: string
): boolean {
  const id = bookmarkId(book, chapter, verse);
  return list.some((b) => bookmarkId(b.book, b.chapter, b.verse) === id);
}

/**
 * Toggles a bookmark in the list. If a bookmark with the same tuple exists it is
 * removed; otherwise the entry is prepended (newest-first). Never duplicates.
 * @param list - Current bookmark list.
 * @param entry - Bookmark to add or (by tuple) remove.
 * @returns A new bookmark list with the entry toggled.
 */
export function toggleBookmarkInList(list: Bookmark[], entry: Bookmark): Bookmark[] {
  if (isBookmarked(list, entry.book, entry.chapter, entry.verse)) {
    return removeBookmarkFromList(list, entry.book, entry.chapter, entry.verse);
  }
  return [entry, ...list];
}

/**
 * Removes the bookmark matching a (book, chapter, verse) tuple.
 * @param list - Current bookmark list.
 * @param book - Book name to match.
 * @param chapter - Chapter number to match.
 * @param verse - Verse number key to match.
 * @returns A new bookmark list without the matching entry.
 */
export function removeBookmarkFromList(
  list: Bookmark[],
  book: string,
  chapter: number,
  verse: string
): Bookmark[] {
  const id = bookmarkId(book, chapter, verse);
  return list.filter((b) => bookmarkId(b.book, b.chapter, b.verse) !== id);
}

/** A cross-book jump (bookmark or go-to-book) awaiting the target book's content to load. */
export interface PendingJump {
  book: string;
  chapter: number;
  /** Verse to highlight/center on completion; omitted for a chapter-only jump. */
  verse?: string;
  /** Skip the scroll animation and snap straight to the target on completion. */
  instant?: boolean;
}

/** The action a content commit should take for a pending cross-book jump. */
export type JumpDecision =
  /** No jump pending - nothing to do. */
  | { action: "none" }
  /** Content loaded for a book other than the target - abandon (clear the ref). */
  | { action: "abandon" }
  /** Target book loaded but the target chapter is absent - drop (clear the ref). */
  | { action: "drop-stale" }
  /** Target book + chapter present - complete: highlight + scroll (verse omitted for a chapter-only jump). */
  | { action: "complete"; chapter: number; verse?: string; instant?: boolean };

/**
 * Pure decision for completing a pending cross-book jump, evaluated on each
 * content commit. Gates on the book `content` ACTUALLY holds (`contentBook`)
 * rather than the synchronously-flipped current-book setting, so a jump never
 * completes against the previous book's stale content. If content has loaded
 * for a different book, the jump was superseded and must be abandoned (so a
 * stashed ref can't permanently suppress later first-verse resets).
 * @param pending - The pending jump target, or null if none is in flight.
 * @param contentBook - The book that the currently-loaded content belongs to.
 * @param contentChapterKeys - Chapter keys present in the loaded content (e.g. ["1","2"]).
 * @returns The action to take: none, abandon, drop-stale, or complete.
 */
export function decidePendingJump(
  pending: PendingJump | null,
  contentBook: string,
  contentChapterKeys: string[]
): JumpDecision {
  if (!pending) {
    return { action: "none" };
  }
  if (contentBook !== pending.book) {
    return { action: "abandon" };
  }
  if (!contentChapterKeys.includes(String(pending.chapter))) {
    return { action: "drop-stale" };
  }
  return { action: "complete", chapter: pending.chapter, verse: pending.verse, instant: pending.instant };
}

/**
 * Converts raw verse HTML into a plain-text snippet: strips tags, collapses
 * whitespace, and truncates at a word boundary (with an ellipsis) if too long.
 * @param html - Raw verse HTML (may contain tags).
 * @param maxLen - Maximum snippet length before truncation (default 80).
 * @returns Plain-text snippet, truncated with "…" when it exceeds maxLen.
 */
export function buildVerseSnippet(html: string, maxLen = 80): string {
  const plain = html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxLen) {
    return plain;
  }

  const hardCut = plain.slice(0, maxLen);
  const lastSpace = hardCut.lastIndexOf(" ");
  const truncated = lastSpace > 0 ? hardCut.slice(0, lastSpace) : hardCut;
  return `${truncated.trimEnd()}…`;
}
