/**
 * Pure, framework-free helpers for the block-structured Bible data. They read
 * verse identity out of the heading/poetry/paragraph block shapes so the reader
 * UI (verse highlighter, j/k navigation, bookmarks) can keep working the same
 * way it did against the old flat verse array.
 */

import type { Block, BookContent } from "@/types/bible";

/**
 * Lists a chapter's distinct verse numbers in reading order. Headings carry no
 * verse; blank poetry lines (verse === null) are skipped; a verse that spans
 * multiple poetry lines or paragraphs appears once, at its first occurrence.
 * @param blocks - The chapter's blocks.
 * @returns Verse-number keys (e.g. ["1", "2", "3"]) in reading order.
 */
export function chapterVerseNumbers(blocks: Block[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const push = (verse: number | null) => {
    if (verse === null) {
      return;
    }
    const key = String(verse);
    if (!seen.has(key)) {
      seen.add(key);
      order.push(key);
    }
  };
  for (const block of blocks) {
    if (block.type === "paragraph") {
      block.verses.forEach((v) => push(v.verse));
    } else if (block.type === "poetry") {
      block.lines.forEach((l) => push(l.verse));
    }
  }
  return order;
}

/**
 * Returns a chapter's first verse-number key, or null if it has no verses.
 * @param blocks - The chapter's blocks.
 * @returns The first verse key, or null.
 */
export function firstVerseNumber(blocks: Block[]): string | null {
  const numbers = chapterVerseNumbers(blocks);
  return numbers.length > 0 ? numbers[0] : null;
}

/**
 * Returns a chapter's last verse-number key, or null if it has no verses.
 * @param blocks - The chapter's blocks.
 * @returns The last verse key, or null.
 */
export function lastVerseNumber(blocks: Block[]): string | null {
  const numbers = chapterVerseNumbers(blocks);
  return numbers.length > 0 ? numbers[numbers.length - 1] : null;
}

/**
 * Concatenates the plain text of a verse across all blocks it appears in
 * (multi-line poetry verses and prose verses alike), space-joined.
 * @param blocks - The chapter's blocks.
 * @param verse - Verse-number key to collect (e.g. "23").
 * @returns The verse's joined plain text, or "" if the verse is absent.
 */
export function findVerseText(blocks: Block[], verse: string): string {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.type === "paragraph") {
      block.verses.forEach((v) => {
        if (String(v.verse) === verse) {
          parts.push(v.text);
        }
      });
    } else if (block.type === "poetry") {
      block.lines.forEach((l) => {
        if (l.verse !== null && String(l.verse) === verse) {
          parts.push(l.text);
        }
      });
    }
  }
  return parts.join(" ").trim();
}

/**
 * Flattens a book's loaded content into an ordered list of {chapter, verse}
 * entries, one per distinct verse, for the j/k verse-highlighter navigation.
 * @param content - Book content keyed by chapter-number string -> blocks.
 * @returns Ordered verse entries across every chapter present.
 */
export function flattenVerses(
  content: BookContent
): { chapter: number; verse: string }[] {
  const verses: { chapter: number; verse: string }[] = [];
  Object.entries(content).forEach(([chapterKey, blocks]) => {
    const chapterNum = parseInt(chapterKey, 10);
    chapterVerseNumbers(blocks).forEach((verse) => {
      verses.push({ chapter: chapterNum, verse });
    });
  });
  return verses;
}
