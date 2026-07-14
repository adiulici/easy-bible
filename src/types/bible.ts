/**
 * Type definitions for the block-structured, multi-translation Bible data.
 * A chapter is an ordered list of blocks (headings, poetry, prose paragraphs);
 * verse text lives inside poetry lines and paragraph verses.
 */

/** Supported translation codes. */
export type Translation = "VDC" | "NTR";

/** All translations in display order. */
export const TRANSLATIONS: Translation[] = ["VDC", "NTR"];

/** Human-readable names for each translation, shown in the switcher. */
export const TRANSLATION_LABELS: Record<Translation, string> = {
  VDC: "Versiunea Dumitru Cornilescu",
  NTR: "Noua Traducere în Limba Română",
};

/**
 * A section/title heading. `level` is the source style class (e.g. "s1", "ms1",
 * "cl", "d") used to pick a visual tier; it carries no verse.
 */
export interface HeadingBlock {
  type: "heading";
  level: string;
  text: string;
}

/**
 * One physical line of poetry. `verse` is the verse number the line belongs to,
 * or null for a blank spacer line. `indent` (>= 0) is the poetic indent depth.
 */
export interface PoetryLine {
  verse: number | null;
  indent: number;
  text: string;
}

/** A block of poetry, rendered as indented physical lines. */
export interface PoetryBlock {
  type: "poetry";
  lines: PoetryLine[];
}

/** One prose verse within a paragraph. */
export interface ParagraphVerse {
  verse: number;
  text: string;
}

/** A prose paragraph containing one or more verses that flow inline. */
export interface ParagraphBlock {
  type: "paragraph";
  verses: ParagraphVerse[];
}

/** Any renderable block in a chapter. */
export type Block = HeadingBlock | PoetryBlock | ParagraphBlock;

/** A chapter is an ordered list of blocks. */
export type ChapterBlocks = Block[];

/** A book's content: chapter-number string -> blocks. */
export interface BookContent {
  [chapterKey: string]: ChapterBlocks;
}
