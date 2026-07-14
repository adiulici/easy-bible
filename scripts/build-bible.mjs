// @ts-check
/**
 * Re-runnable data-transform: reads the bible-fetcher `out/<VERSION>/<USFM>/<n>.json`
 * tree (block-structured chapters) and emits one bundled file per translation at
 * `src/data/bible.<VERSION>.json`, keyed by Romanian book name -> chapter-number
 * string -> Block[]. Only the `blocks` payload is kept (per-chapter metadata is
 * dropped to keep the bundle small).
 *
 * The fetcher keys books by USFM code; the app keys everything by Romanian book
 * name (books.json). Both lists are the same 66 books in canonical Protestant
 * order, so the mapping is purely by ordinal position (CANONICAL_USFM[i] <->
 * books.json[i]). A guardrail asserts the fetcher's book dirs are exactly the
 * canonical set before mapping, so a bad ordinal map can't silently ship.
 *
 * The fetcher `out/` location is machine-specific (it lives in a separate repo),
 * so it is supplied explicitly rather than hardcoded: pass it as the first CLI
 * arg, or set the BIBLE_FETCHER_OUT env var.
 *
 * Usage: node scripts/build-bible.mjs <pathToFetcherOut>
 *    or: BIBLE_FETCHER_OUT=<path> node scripts/build-bible.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const FETCHER_OUT = process.argv[2] || process.env.BIBLE_FETCHER_OUT;
const VERSIONS = ['VDC', 'NTR'];

// Canonical Protestant 66-book order as USFM codes. Position i corresponds to
// books.json[i] (verified: both are the same books in the same canonical order).
const CANONICAL_USFM = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
  '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL', 'MAT',
  'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP',
  'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE',
  '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
];

/**
 * Asserts a condition, throwing a labelled error when it fails.
 * @param {boolean} cond - Condition that must hold.
 * @param {string} message - Error message when the condition is false.
 * @returns {void}
 */
function assert(cond, message) {
  if (!cond) {
    throw new Error(`build-bible: ${message}`);
  }
}

/**
 * Loads the app's canonical Romanian book-name list.
 * @returns {string[]} 66 Romanian book names in canonical order.
 */
function loadBookNames() {
  const raw = fs.readFileSync(path.join(REPO_ROOT, 'src/data/books.json'), 'utf8');
  const names = JSON.parse(raw);
  assert(Array.isArray(names) && names.length === 66, `books.json must list 66 books, got ${names.length}`);
  return names;
}

/**
 * Verifies the fetcher's book dirs for a version are exactly the canonical set.
 * @param {string} versionDir - Absolute path to `out/<VERSION>`.
 * @returns {void}
 */
function assertCanonicalBooks(versionDir) {
  const dirs = fs.readdirSync(versionDir).filter((d) =>
    fs.statSync(path.join(versionDir, d)).isDirectory()
  );
  const expected = new Set(CANONICAL_USFM);
  const actual = new Set(dirs);
  assert(actual.size === expected.size, `${versionDir}: expected 66 book dirs, got ${actual.size}`);
  for (const code of expected) {
    assert(actual.has(code), `${versionDir}: missing book dir ${code}`);
  }
}

/**
 * Reads one book's chapters into a chapter-number-string -> Block[] map.
 * @param {string} bookDir - Absolute path to `out/<VERSION>/<USFM>`.
 * @returns {Record<string, unknown[]>} Chapters keyed by numeric string.
 */
function readBook(bookDir) {
  /** @type {Record<string, unknown[]>} */
  const chapters = {};
  const files = fs.readdirSync(bookDir)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  for (const file of files) {
    const num = parseInt(file, 10);
    assert(Number.isInteger(num) && num > 0, `${bookDir}/${file}: non-numeric chapter file`);
    const data = JSON.parse(fs.readFileSync(path.join(bookDir, file), 'utf8'));
    assert(Array.isArray(data.blocks), `${bookDir}/${file}: missing blocks array`);
    chapters[String(num)] = data.blocks;
  }
  return chapters;
}

/**
 * Builds and writes the bundled file for one translation.
 * @param {string} version - Translation code (e.g. "VDC").
 * @param {string[]} bookNames - Canonical Romanian book names.
 * @param {string} fetcherOut - Absolute path to the fetcher `out/` tree.
 * @returns {{ books: number, chapters: number, outPath: string }} Summary counts.
 */
function buildVersion(version, bookNames, fetcherOut) {
  const versionDir = path.join(fetcherOut, version);
  assert(fs.existsSync(versionDir), `missing version dir ${versionDir}`);
  assertCanonicalBooks(versionDir);

  /** @type {Record<string, Record<string, unknown[]>>} */
  const bundle = {};
  let chapterCount = 0;
  CANONICAL_USFM.forEach((usfm, i) => {
    const name = bookNames[i];
    const chapters = readBook(path.join(versionDir, usfm));
    bundle[name] = chapters;
    chapterCount += Object.keys(chapters).length;
  });

  const outPath = path.join(REPO_ROOT, `src/data/bible.${version}.json`);
  fs.writeFileSync(outPath, JSON.stringify(bundle));
  return { books: Object.keys(bundle).length, chapters: chapterCount, outPath };
}

function main() {
  if (!FETCHER_OUT) {
    throw new Error(
      'build-bible: provide the bible-fetcher out/ path as the first argument, or set BIBLE_FETCHER_OUT'
    );
  }
  const bookNames = loadBookNames();
  assert(CANONICAL_USFM.length === 66, `CANONICAL_USFM must list 66 codes, got ${CANONICAL_USFM.length}`);
  for (const version of VERSIONS) {
    const summary = buildVersion(version, bookNames, FETCHER_OUT);
    // eslint-disable-next-line no-console
    console.log(`${version}: ${summary.books} books, ${summary.chapters} chapters -> ${summary.outPath}`);
  }
}

main();
