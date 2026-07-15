/**
 * A user note attached to a single verse. Multiple notes may share the same
 * (book, chapter, verse) identity. Translation-agnostic, like Bookmark.
 */
export interface Note {
  id: number;
  book: string;
  chapter: number;
  verse: string;
  body: string;
  /** ISO 8601 timestamp string, as returned by Postgres. */
  createdAt: string;
  /** ISO 8601 timestamp string, set on first edit; null until then. */
  updatedAt: string | null;
}
