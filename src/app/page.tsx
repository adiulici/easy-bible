"use client";
import { useState, useEffect, useMemo, useRef, useCallback, type CSSProperties } from "react";
import styles from "./page.module.css";
import { useKeyboardCommands } from "@/hooks/useKeyboardCommands";
import VisibilityModal from "@/components/VisibilityModal";
import CommandModal from "@/components/CommandModal";
import BookmarksModal from "@/components/BookmarksModal";
import TranslationModal from "@/components/TranslationModal";
import Toast from "@/components/Toast";
import StickyHeader from "@/components/StickyHeader";
import { useSettings } from "@/context/SettingsContext";
import books from "@/data/books.json";
import { findBestMatch } from "@/utils/fuzzySearch";
import { parseBookNavigationInput, hasChapterSuffix } from "@/utils/bookNavigation";
import { createScrollQueue } from "@/utils/scrollQueue";
import { buildVerseSnippet, decidePendingJump, type Bookmark } from "@/utils/bookmarks";
import type { Block, BookContent } from "@/types/bible";
import { TRANSLATION_LABELS } from "@/types/bible";
import {
  firstVerseNumber,
  lastVerseNumber,
  findVerseText,
  flattenVerses,
} from "@/utils/blocks";

// Single shared queue for every programmatic window scroll (chapter jumps,
// verse-into-view nudges, j/k page nudges), so overlapping smooth-scroll
// calls never fight each other. See scrollQueue.ts for why this exists.
const scrollQueue = createScrollQueue();

/**
 * Returns the absolute scroll offset that puts a chapter's element near the top of the viewport.
 * @param chapterNumber - Chapter key (e.g. "3") whose element to measure.
 * @returns Absolute Y offset to scroll to.
 */
function getChapterScrollY(chapterNumber: string): number {
  return (document.getElementById(`chapter-${chapterNumber}`)?.offsetTop ?? 0) - 30;
}

/**
 * Queues a scroll to a chapter. Coalesced with any other pending chapter jump
 * so rapid-fire navigation ends up as one glide to the final target instead
 * of a stack of interrupted animations.
 * @param chapterNumber - Chapter key (e.g. "3") whose element to scroll to.
 * @param options.instant - Skip the glide and snap straight there.
 * @returns void
 */
function smoothScrollToChapter(chapterNumber: string, options: { instant?: boolean } = {}) {
  scrollQueue.enqueueAbsolute(() => getChapterScrollY(chapterNumber), {
    coalesceKey: "chapter-jump",
    suppressTracking: true,
    instant: options.instant,
  });
}

// Matches the reading-band IntersectionObserver's rootMargin ('-20% 0px -50%
// 0px'): the "active" band is the middle slice of the viewport from 20% down
// to 50% down.
const READING_BAND_TOP_FRACTION = 0.2;
const READING_BAND_BOTTOM_FRACTION = 0.5;

/**
 * Finds whichever chapter occupies the most of the reading band right now,
 * via direct synchronous measurement instead of the IntersectionObserver.
 * Used to resync currentChapter once a suppress-tracking scroll (page
 * down/up) settles, since tracking was off during the scroll itself.
 * @param chapterKeys - Chapter keys (e.g. ["1", "2", ...]) currently rendered.
 * @returns The dominant chapter number, or null if none intersect the band.
 */
function getDominantChapterInReadingBand(chapterKeys: string[]): number | null {
  const viewportHeight = window.innerHeight;
  const bandTop = viewportHeight * READING_BAND_TOP_FRACTION;
  const bandBottom = viewportHeight * (1 - READING_BAND_BOTTOM_FRACTION);

  let maxIntersectionHeight = 0;
  let dominant: number | null = null;

  chapterKeys.forEach((chapterKey) => {
    const element = document.getElementById(`chapter-${chapterKey}`);
    if (!element) {
      return;
    }
    const rect = element.getBoundingClientRect();
    const intersectionHeight = Math.min(rect.bottom, bandBottom) - Math.max(rect.top, bandTop);
    if (intersectionHeight > maxIntersectionHeight) {
      maxIntersectionHeight = intersectionHeight;
      dominant = parseInt(chapterKey, 10);
    }
  });

  return dominant;
}

/**
 * Picks the semantic element for a heading block. Section headings become real
 * headings (nested under the book's <h1>); chapter labels, psalm ascriptions and
 * major-section reference ranges are decorative labels, so they stay <div>.
 * @param level - The heading's source style class (e.g. "s1", "ms1", "cl").
 * @returns The tag name to render the heading with.
 */
function headingTag(level: string): "h2" | "h3" | "div" {
  switch (level) {
    case "ms1":
    case "s1":
      return "h2";
    case "ms2":
    case "s2":
      return "h3";
    default:
      // mr (reference range), cl (chapter label), d (ascription): labels, not headings.
      return "div";
  }
}

type ChapterRenderProps = {
  blocks: Block[];
  chapterNumber: number;
  showVerseNumbers: boolean;
  highlightedVerse: { chapter: number; verse: string } | null;
  showVerseHighlighter: boolean;
  bookmarkedVerseKeys: Set<string>;
  onVerseClick: (chapter: number, verse: string) => void;
};

/**
 * Renders one chapter's block structure (headings, poetry, prose paragraphs)
 * while preserving the per-verse hooks the reader relies on: `data-chapter` /
 * `data-verse` attributes (for scroll + highlight lookups), the highlight and
 * bookmark classes, and click-to-select. Verse numbers show once per verse
 * (at its first line), so multi-line poetry verses aren't renumbered.
 * @param props - Chapter blocks, chapter number, and display/interaction state.
 * @returns The chapter's rendered blocks.
 */
function Chapter({
  blocks,
  chapterNumber,
  showVerseNumbers,
  highlightedVerse,
  showVerseHighlighter,
  bookmarkedVerseKeys,
  onVerseClick,
}: ChapterRenderProps) {
  // Tracks verse numbers already rendered in this chapter so the verse number
  // shows once (at a verse's first line), not on every continuation line.
  const shown = new Set<string>();
  const isFirstOccurrence = (verseKey: string): boolean => {
    if (shown.has(verseKey)) {
      return false;
    }
    shown.add(verseKey);
    return true;
  };

  const verseClassName = (verseKey: string): string => {
    const isHighlighted =
      highlightedVerse?.chapter === chapterNumber && highlightedVerse?.verse === verseKey;
    const isBookmarked = bookmarkedVerseKeys.has(`${chapterNumber}:${verseKey}`);
    return `${styles.verse} ${showVerseHighlighter && isHighlighted ? styles.verseHighlighted : ""} ${isBookmarked ? styles.verseBookmarked : ""}`;
  };

  /**
   * Renders a single verse-bearing span (used by both prose and poetry).
   * @param verseKey - Verse-number key (e.g. "3").
   * @param text - The verse (or line) text.
   * @param key - React key.
   * @returns The verse span element.
   */
  const renderVerse = (verseKey: string, text: string, key: string) => {
    const showNumber = showVerseNumbers && isFirstOccurrence(verseKey);
    return (
      <span
        key={key}
        data-chapter={chapterNumber}
        data-verse={verseKey}
        className={verseClassName(verseKey)}
        onClick={() => onVerseClick(chapterNumber, verseKey)}
      >
        {showNumber && <sup className={styles.verseNumber}>{verseKey}</sup>}
        {text}
      </span>
    );
  };

  return (
    <>
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          const level = block.level;
          const Tag = headingTag(level);
          return (
            <Tag
              key={blockIndex}
              className={`${styles.heading} ${styles[`heading_${level}`] ?? ""}`}
              data-level={level}
            >
              {block.text}
            </Tag>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p key={blockIndex} className={styles.paragraph}>
              {block.verses.map((v, i) =>
                renderVerse(String(v.verse), `${v.text} `, `${blockIndex}-${i}`)
              )}
            </p>
          );
        }

        // poetry
        return (
          <div key={blockIndex} className={styles.poetry}>
            {block.lines.map((line, i) => {
              if (line.verse === null) {
                return <div key={i} className={styles.poetryBlank} aria-hidden="true" />;
              }
              return (
                <div
                  key={i}
                  className={styles.poetryLine}
                  style={{ "--indent": line.indent } as CSSProperties}
                >
                  {renderVerse(String(line.verse), line.text, `${blockIndex}-${i}`)}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/**
 * Renders every loaded chapter of a book, each wrapped in a positioned
 * container carrying its `chapter-<n>` id (scroll target) and optional
 * watermark number.
 * @param props - Book content and display/interaction state.
 * @returns The book's rendered chapters.
 */
function Book({
  book,
  showChapterNumbers,
  showVerseNumbers,
  highlightedVerse,
  showVerseHighlighter,
  bookmarkedVerseKeys,
  onVerseClick,
}: {
  book: BookContent;
  showChapterNumbers: boolean;
  showVerseNumbers: boolean;
  highlightedVerse: { chapter: number; verse: string } | null;
  showVerseHighlighter: boolean;
  bookmarkedVerseKeys: Set<string>;
  onVerseClick: (chapter: number, verse: string) => void;
}) {
  return (
    <>
      {Object.entries(book).map(([chapterKey, blocks]) => {
        const chapterNum = parseInt(chapterKey, 10);
        return (
          <div key={chapterKey} id={`chapter-${chapterKey}`} className={styles.chapterBlock}>
            {showChapterNumbers && (
              <span className={styles.chapter}>{chapterNum}.</span>
            )}
            <Chapter
              blocks={blocks}
              chapterNumber={chapterNum}
              showVerseNumbers={showVerseNumbers}
              highlightedVerse={highlightedVerse}
              showVerseHighlighter={showVerseHighlighter}
              bookmarkedVerseKeys={bookmarkedVerseKeys}
              onVerseClick={onVerseClick}
            />
          </div>
        );
      })}
    </>
  );
}

export default function Home() {
  const [content, setContent] = useState<BookContent>({});
  
  // Settings from context
  const { settings, toggleSetting, setSetting, toggleBookmark, removeBookmark } = useSettings();
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);

  // Transient toast (e.g. the "turn on the highlighter" hint). Local page
  // state + a small presentational component; no portal/context system.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pending cross-book bookmark jump, consumed by a content-keyed effect once
  // the target book's content has loaded. See the jump effect below.
  const pendingJumpRef = useRef<{ book: string; chapter: number; verse: string } | null>(null);

  // Which book `content` currently holds. `content` itself carries no book
  // identity, and `settings.currentBook` flips synchronously (ahead of the
  // async fetch), so this ref is the only reliable "content IS book X" signal.
  // Set in the fetch `.then` on success, right where setContent runs.
  const contentBookRef = useRef<string>("");

  // Verse highlighter state - tracks current highlighted verse
  const [highlightedVerse, setHighlightedVerse] = useState<{ chapter: number; verse: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Ref to track last navigation time for smooth key repeat handling
  const lastNavigationTime = useRef<number>(0);
  const navigationThrottleMs = 50; // Minimum ms between navigation actions

  // Keyboard commands hook
  const { activeMode, inputBuffer, registerCommand, cancelCommand, setInputBuffer } = useKeyboardCommands();

  // Build a flat list of all verses for navigation (one entry per distinct
  // verse, in reading order across the block structure).
  const allVerses = useMemo(() => flattenVerses(content), [content]);

  // Vimium-style scroll step used by j/k when the verse highlighter is off
  const SCROLL_STEP_PX = 100;

  // How much viewport height d/u page down/up by, leaving a small overlap
  // for reading continuity across the jump
  const PAGE_SCROLL_OVERLAP_PX = 60;

  // Counts suppress-tracking scroll presses (j/k nudges and d/u page scrolls)
  // that haven't settled yet, so a rapid burst (or held-down key) only
  // resyncs currentChapter once, after the *last* one settles - not once per
  // coalesced task. Resyncing after every task would call setSetting
  // mid-burst, and the resulting re-render would stall the next queued task's
  // requestAnimationFrame loop right as it's meant to start, which is just as
  // visible as the original jank.
  const pendingScrollResyncs = useRef(0);

  // Resyncs currentChapter after a suppress-tracking scroll settles, since
  // tracking was off (and thus not updating it) during the scroll itself.
  const resyncCurrentChapterFromScroll = useCallback(() => {
    pendingScrollResyncs.current--;
    if (pendingScrollResyncs.current > 0) {
      return;
    }
    const dominant = getDominantChapterInReadingBand(Object.keys(content));
    if (dominant !== null && dominant !== currentChapterRef.current) {
      setSetting("currentChapter", dominant);
    }
  }, [content, setSetting]);

  // Handle verse highlighter navigation with throttling for smooth key repeat
  const handleMoveHighlighterDown = useCallback(() => {
    // Only work when no modal is open
    if (activeMode !== null) {
      return;
    }

    // Throttle navigation for smooth key repeat
    const now = Date.now();
    if (now - lastNavigationTime.current < navigationThrottleMs) {
      return;
    }
    lastNavigationTime.current = now;

    // With the highlighter off, j/k just nudge the scroll position
    // (Vimium-style). suppressTracking + deferred resync mirrors d/u: without
    // it, a held key eventually scrolls across a chapter boundary, the
    // reading-band IntersectionObserver fires setSetting("currentChapter")
    // mid-scroll, and the re-render of the whole unvirtualized book stalls the
    // animation's requestAnimationFrame loop - the "janky when held" symptom.
    // Tracking is resynced once the burst settles instead.
    if (!settings.showVerseHighlighter) {
      pendingScrollResyncs.current++;
      scrollQueue
        .enqueueDelta(SCROLL_STEP_PX, "highlighter-nudge", { suppressTracking: true })
        .then(resyncCurrentChapterFromScroll);
      return;
    }

    setHighlightedVerse((prev) => {
      if (!prev) {
        // If no verse highlighted, start at first verse
        return allVerses[0] || null;
      }
      const currentIndex = allVerses.findIndex(
        (v) => v.chapter === prev.chapter && v.verse === prev.verse
      );
      if (currentIndex < allVerses.length - 1) {
        return allVerses[currentIndex + 1];
      }
      return prev;
    });
  }, [activeMode, allVerses, settings.showVerseHighlighter, resyncCurrentChapterFromScroll]);

  const handleMoveHighlighterUp = useCallback(() => {
    // Only work when no modal is open
    if (activeMode !== null) {
      return;
    }

    // Throttle navigation for smooth key repeat
    const now = Date.now();
    if (now - lastNavigationTime.current < navigationThrottleMs) {
      return;
    }
    lastNavigationTime.current = now;

    // See handleMoveHighlighterDown for why this suppresses tracking + resyncs
    if (!settings.showVerseHighlighter) {
      pendingScrollResyncs.current++;
      scrollQueue
        .enqueueDelta(-SCROLL_STEP_PX, "highlighter-nudge", { suppressTracking: true })
        .then(resyncCurrentChapterFromScroll);
      return;
    }

    setHighlightedVerse((prev) => {
      if (!prev) {
        // If no verse highlighted, start at first verse
        return allVerses[0] || null;
      }
      const currentIndex = allVerses.findIndex(
        (v) => v.chapter === prev.chapter && v.verse === prev.verse
      );
      if (currentIndex > 0) {
        return allVerses[currentIndex - 1];
      }
      return prev;
    });
  }, [activeMode, allVerses, settings.showVerseHighlighter, resyncCurrentChapterFromScroll]);

  // Handle verse click - always switch to that verse, even if highlighter is off
  const handleVerseClick = useCallback((chapter: number, verse: string) => {
    setHighlightedVerse({ chapter, verse });
  }, []);

  const TOAST_DURATION_MS = 2500;
  /**
   * Shows a transient toast message, auto-dismissed after a short delay. Any
   * previously scheduled dismissal is cancelled so the newest message gets the
   * full duration.
   * @param message - The text to display in the toast.
   * @returns void
   */
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  // Clear any pending toast timer on unmount.
  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  // Keys ("chapter:verse") of bookmarks in the current book, for the in-text
  // marker. O(1) membership test per rendered verse.
  const bookmarkedVerseKeys = useMemo(() => {
    return new Set(
      settings.bookmarks
        .filter((b) => b.book === settings.currentBook)
        .map((b) => `${b.chapter}:${b.verse}`)
    );
  }, [settings.bookmarks, settings.currentBook]);

  /**
   * Queues a scroll that centers a verse ~1/3 down the viewport. The target
   * is measured lazily when the task runs; returns null (queue skips, no
   * crash) if the verse element is absent (e.g. a stale bookmark).
   * @param chapter - Chapter number of the verse to center.
   * @param verse - Verse number key to center.
   * @param options.instant - Skip the glide and snap straight there.
   * @returns void
   */
  const scrollVerseIntoCenter = useCallback((chapter: number, verse: string, options: { instant?: boolean } = {}) => {
    scrollQueue.enqueueAbsolute(
      () => {
        const verseElement = contentRef.current?.querySelector(
          `[data-chapter="${chapter}"][data-verse="${verse}"]`
        ) as HTMLElement | null;
        if (!verseElement) {
          return null;
        }
        const rect = verseElement.getBoundingClientRect();
        return window.scrollY + rect.top - window.innerHeight * 0.3;
      },
      { coalesceKey: "jump-verse", suppressTracking: true, instant: options.instant }
    );
  }, []);

  /**
   * Navigates to a bookmark. Same-book jumps set chapter/highlight and scroll
   * immediately (content is present). Cross-book jumps stash the target in
   * pendingJumpRef and switch book/chapter; a content-keyed effect completes
   * the highlight + scroll once the new book has loaded.
   * @param bookmark - The bookmark to jump to.
   * @returns void
   */
  const handleBookmarkJump = useCallback((bookmark: Bookmark) => {
    if (bookmark.book === settings.currentBook) {
      setSetting("currentChapter", bookmark.chapter);
      setHighlightedVerse({ chapter: bookmark.chapter, verse: bookmark.verse });
      scrollVerseIntoCenter(bookmark.chapter, bookmark.verse);
      return;
    }
    pendingJumpRef.current = {
      book: bookmark.book,
      chapter: bookmark.chapter,
      verse: bookmark.verse,
    };
    setSetting("currentBook", bookmark.book);
    setSetting("currentChapter", bookmark.chapter);
  }, [settings.currentBook, setSetting, scrollVerseIntoCenter]);

  // The `m` handler needs several volatile values (highlighted verse, loaded
  // content, highlighter flag, current book, active mode) but must keep a STABLE
  // identity - otherwise the command-registration effect below re-runs on every
  // j/k (which moves highlightedVerse), re-issuing every registerCommand mid
  // scroll. So we mirror those values into a ref and read them at call time; the
  // captured snippet still reflects the latest values, just via the ref.
  // Refreshed on every render so the stable `m` handler always reads the latest
  // values (a plain ref assignment, not an effect — the ref just holds "latest").
  const toggleBookmarkInputsRef = useRef({
    activeMode,
    highlightedVerse,
    content,
    showVerseHighlighter: settings.showVerseHighlighter,
    currentBook: settings.currentBook,
  });
  toggleBookmarkInputsRef.current = {
    activeMode,
    highlightedVerse,
    content,
    showVerseHighlighter: settings.showVerseHighlighter,
    currentBook: settings.currentBook,
  };

  /**
   * Toggles a bookmark on the currently highlighted verse (the `m` command).
   * Requires the highlighter to be on and a verse selected; otherwise shows a
   * hint toast and is a no-op. Captures a plain-text snippet at creation. Reads
   * volatile inputs from a ref so its identity stays stable (see the ref above).
   * @returns void
   */
  const handleToggleBookmark = useCallback(() => {
    const { activeMode, highlightedVerse, content, showVerseHighlighter, currentBook } =
      toggleBookmarkInputsRef.current;
    if (activeMode !== null) {
      return;
    }
    if (!showVerseHighlighter || !highlightedVerse) {
      showToast("Turn on the verse highlighter to bookmark");
      return;
    }
    const { chapter, verse } = highlightedVerse;
    const verseText = findVerseText(content[String(chapter)] ?? [], verse);
    toggleBookmark({
      book: currentBook,
      chapter,
      verse,
      text: buildVerseSnippet(verseText),
      createdAt: Date.now(),
    });
  }, [toggleBookmark, showToast]);

  // Handle chapter navigation
  const handleGoToNextChapter = useCallback(() => {
    // Only work when no modal is open
    if (activeMode !== null) {
      return;
    }

    // Read from the ref (not settings.currentChapter) so this callback's
    // identity doesn't change every time currentChapter updates - it's also
    // a dependency of the "Register commands" effect below, and recreating
    // it on every chapter-tracking update meant that effect re-ran (12
    // registerCommand calls) on every currentChapter change, which could
    // stall an in-flight scroll animation's requestAnimationFrame loop for
    // a frame.
    const nextChapter = currentChapterRef.current + 1;
    const chapterKey = nextChapter.toString();

    // Check if next chapter exists in current book
    if (content[chapterKey]) {
      // Update current chapter in settings
      setSetting("currentChapter", nextChapter);
      // Scroll to chapter
      smoothScrollToChapter(chapterKey);
      // Reset verse highlighter to first verse of new chapter
      const firstVerse = firstVerseNumber(content[chapterKey]);
      if (firstVerse) {
        setHighlightedVerse({ chapter: nextChapter, verse: firstVerse });
      }
    }
    // If at last chapter, do nothing
  }, [activeMode, content, setSetting]);

  const handleGoToPreviousChapter = useCallback(() => {
    // Only work when no modal is open
    if (activeMode !== null) {
      return;
    }

    // See handleGoToNextChapter for why this reads the ref instead of settings.currentChapter
    const prevChapter = currentChapterRef.current - 1;
    const chapterKey = prevChapter.toString();

    // Check if previous chapter exists in current book
    if (prevChapter > 0 && content[chapterKey]) {
      // Update current chapter in settings
      setSetting("currentChapter", prevChapter);
      // Scroll to chapter
      smoothScrollToChapter(chapterKey);
      // Reset verse highlighter to first verse of new chapter
      const firstVerse = firstVerseNumber(content[chapterKey]);
      if (firstVerse) {
        setHighlightedVerse({ chapter: prevChapter, verse: firstVerse });
      }
    }
    // If at first chapter, do nothing
  }, [activeMode, content, setSetting]);

  // Handle jump to top (first chapter, first verse)
  const handleGoToTop = useCallback(() => {
    // Only work when no modal is open
    if (activeMode !== null) {
      return;
    }

    const chapterKeys = Object.keys(content);
    if (chapterKeys.length === 0) {
      return;
    }

    const firstChapterKey = chapterKeys[0];
    const firstChapterNumber = parseInt(firstChapterKey, 10);
    setSetting("currentChapter", firstChapterNumber);
    smoothScrollToChapter(firstChapterKey);
    const firstVerse = firstVerseNumber(content[firstChapterKey]);
    if (firstVerse) {
      setHighlightedVerse({ chapter: firstChapterNumber, verse: firstVerse });
    }
  }, [activeMode, content, setSetting]);

  // Handle jump to bottom (last chapter, last verse)
  const handleGoToBottom = useCallback(() => {
    // Only work when no modal is open
    if (activeMode !== null) {
      return;
    }

    const chapterKeys = Object.keys(content);
    if (chapterKeys.length === 0) {
      return;
    }

    const lastChapterKey = chapterKeys[chapterKeys.length - 1];
    const lastChapterNumber = parseInt(lastChapterKey, 10);
    setSetting("currentChapter", lastChapterNumber);
    smoothScrollToChapter(lastChapterKey);
    const lastVerse = lastVerseNumber(content[lastChapterKey]);
    if (lastVerse) {
      setHighlightedVerse({ chapter: lastChapterNumber, verse: lastVerse });
    }
  }, [activeMode, content, setSetting]);

  // Handle page down/up - a plain viewport-height scroll, not tied to
  // chapter boundaries. Tracking is suppressed *during* the scroll and
  // resynced once it settles, rather than left live throughout: a page
  // covers enough distance to reliably cross a chapter boundary mid-flight,
  // and letting currentChapter update live there triggered a React
  // re-render (the whole book's DOM is rendered unvirtualized) that could
  // stall the scroll's requestAnimationFrame loop for a frame - visible as
  // jank right at the boundary crossing.
  const handlePageDown = useCallback(() => {
    // Only work when no modal is open
    if (activeMode !== null) {
      return;
    }

    pendingScrollResyncs.current++;
    scrollQueue
      .enqueueDelta(window.innerHeight - PAGE_SCROLL_OVERLAP_PX, "page-scroll", { suppressTracking: true })
      .then(resyncCurrentChapterFromScroll);
  }, [activeMode, resyncCurrentChapterFromScroll]);

  const handlePageUp = useCallback(() => {
    // Only work when no modal is open
    if (activeMode !== null) {
      return;
    }

    pendingScrollResyncs.current++;
    scrollQueue
      .enqueueDelta(-(window.innerHeight - PAGE_SCROLL_OVERLAP_PX), "page-scroll", { suppressTracking: true })
      .then(resyncCurrentChapterFromScroll);
  }, [activeMode, resyncCurrentChapterFromScroll]);

  // Content width bounds and step for the [ / ] adjustment commands
  const MIN_CONTENT_WIDTH = 600;
  const CONTENT_WIDTH_MARGIN = 80;
  const CONTENT_WIDTH_STEP = 50;

  const handleDecreaseWidth = useCallback(() => {
    setSetting(
      "contentWidth",
      Math.max(MIN_CONTENT_WIDTH, settings.contentWidth - CONTENT_WIDTH_STEP)
    );
  }, [settings.contentWidth, setSetting]);

  const handleIncreaseWidth = useCallback(() => {
    const maxContentWidth = window.innerWidth - CONTENT_WIDTH_MARGIN;
    setSetting(
      "contentWidth",
      Math.min(maxContentWidth, settings.contentWidth + CONTENT_WIDTH_STEP)
    );
  }, [settings.contentWidth, setSetting]);

  // Auto-scroll when highlighted verse moves off-screen. The rect is
  // measured lazily inside the queued task (not here) so a burst of j/k
  // presses reads the verse's settled position instead of a stale one.
  useEffect(() => {
    if (!highlightedVerse || !settings.showVerseHighlighter || !contentRef.current) {
      return;
    }

    const { chapter, verse } = highlightedVerse;

    scrollQueue.enqueueAbsolute(
      () => {
        const verseElement = contentRef.current?.querySelector(
          `[data-chapter="${chapter}"][data-verse="${verse}"]`
        ) as HTMLElement | null;
        if (!verseElement) {
          return null;
        }

        const rect = verseElement.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const padding = 100;

        // Verse is below viewport
        if (rect.bottom > viewportHeight - padding) {
          return window.scrollY + (rect.bottom - viewportHeight + padding + 50);
        }
        // Verse is above viewport
        if (rect.top < padding) {
          return window.scrollY + (rect.top - padding);
        }
        return null;
      },
      { coalesceKey: "verse-into-view" }
    );
  }, [highlightedVerse, settings.showVerseHighlighter]);

  // Register commands
  useEffect(() => {
    registerCommand({
      key: "v",
      type: "modal",
      mode: "visibility",
    });
    registerCommand({
      key: "c",
      type: "modal",
      mode: "goto-chapter",
    });
    registerCommand({
      key: "b",
      type: "modal",
      mode: "goto-book",
    });
    registerCommand({
      key: "j",
      type: "single",
      handler: handleMoveHighlighterDown,
    });
    registerCommand({
      key: "k",
      type: "single",
      handler: handleMoveHighlighterUp,
    });
    registerCommand({
      key: "u",
      type: "single",
      handler: handlePageUp,
    });
    registerCommand({
      key: "d",
      type: "single",
      handler: handlePageDown,
    });
    registerCommand({
      key: "gg",
      type: "single",
      handler: handleGoToTop,
    });
    registerCommand({
      key: "G",
      type: "single",
      handler: handleGoToBottom,
    });
    registerCommand({
      key: "n",
      type: "single",
      handler: handleGoToNextChapter,
    });
    registerCommand({
      key: "N",
      type: "single",
      handler: handleGoToPreviousChapter,
    });
    registerCommand({
      key: "[",
      type: "single",
      handler: handleDecreaseWidth,
    });
    registerCommand({
      key: "]",
      type: "single",
      handler: handleIncreaseWidth,
    });
    registerCommand({
      key: "m",
      type: "single",
      handler: handleToggleBookmark,
    });
    registerCommand({
      key: "M",
      type: "modal",
      mode: "bookmarks",
    });
    registerCommand({
      key: "t",
      type: "modal",
      mode: "translation",
    });
  }, [registerCommand, handleMoveHighlighterDown, handleMoveHighlighterUp, handlePageUp, handlePageDown, handleGoToTop, handleGoToBottom, handleGoToNextChapter, handleGoToPreviousChapter, handleDecreaseWidth, handleIncreaseWidth, handleToggleBookmark]);

  // Handle visibility modal open/close based on activeMode
  useEffect(() => {
    setIsVisibilityModalOpen(activeMode === "visibility");
  }, [activeMode]);

  // Toggle visibility setting
  const handleToggleVisibility = (
    setting: "showChapterNumbers" | "showVerseNumbers" | "showVerseHighlighter"
  ) => {
    toggleSetting(setting);
  };

  // Close visibility modal
  const handleCloseVisibilityModal = () => {
    cancelCommand();
  };

  // Handle "Go to Chapter" command
  const handleGoToChapter = () => {
    const chapterNum = parseInt(inputBuffer.trim(), 10);
    
    // Validate chapter number exists in current book
    if (!isNaN(chapterNum) && chapterNum > 0) {
      const chapterKey = chapterNum.toString();
      if (content[chapterKey]) {
        // Update current chapter in settings
        setSetting("currentChapter", chapterNum);
        // Scroll to chapter
        smoothScrollToChapter(chapterKey);
        // Close modal and clear input
        cancelCommand();
      } else {
        // Invalid chapter number - just close modal
        cancelCommand();
      }
    } else {
      // Invalid input - just close modal
      cancelCommand();
    }
  };

  // Calculate autocomplete suggestion for book search. Suppressed once the
  // input has moved past the book name into a chapter/verse suffix - Tab would
  // otherwise clobber that suffix by replacing the whole buffer with just the
  // matched book name.
  const bookAutocomplete = useMemo(() => {
    if (activeMode !== "goto-book" || !inputBuffer.trim() || hasChapterSuffix(inputBuffer)) {
      return null;
    }
    return findBestMatch(inputBuffer, books as string[]);
  }, [activeMode, inputBuffer]);

  /**
   * Handles the "Go to Book" command (`b`). Accepts "Book", "Book Chapter", or
   * "Book Chapter:Verse" (fuzzy-matched book name). Same-book targets navigate
   * immediately against the already-loaded content; cross-book targets always
   * stash a pendingJumpRef the content-load effect completes once the new
   * book's content arrives - the same mechanism cross-book bookmark jumps
   * use, so an out-of-range verse degrades gracefully exactly like a stale
   * bookmark does. Jumps straight there with no scroll animation.
   * @returns void
   */
  const handleGoToBook = () => {
    const input = inputBuffer.trim();

    if (!input) {
      cancelCommand();
      return;
    }

    const target = parseBookNavigationInput(input, books as string[]);

    if (!target) {
      cancelCommand();
      return;
    }

    if (target.book === settings.currentBook) {
      const chapterKey = target.chapter.toString();
      if (content[chapterKey]) {
        setSetting("currentChapter", target.chapter);
        if (target.verse) {
          setHighlightedVerse({ chapter: target.chapter, verse: target.verse });
          scrollVerseIntoCenter(target.chapter, target.verse, { instant: true });
        } else {
          smoothScrollToChapter(chapterKey, { instant: true });
          // Mirror handleGoToNextChapter/PreviousChapter: a chapter jump with
          // no explicit verse still moves the j/k cursor to the new chapter's
          // first verse, so it doesn't stay stranded on the old chapter.
          const firstVerse = firstVerseNumber(content[chapterKey]);
          if (firstVerse) {
            setHighlightedVerse({ chapter: target.chapter, verse: firstVerse });
          }
        }
      }
      cancelCommand();
      return;
    }

    pendingJumpRef.current = {
      book: target.book,
      chapter: target.chapter,
      verse: target.verse,
      instant: true,
    };
    setSetting("currentBook", target.book);
    setSetting("currentChapter", target.chapter);
    // Scroll to top immediately so the old book's content doesn't sit at a
    // stale scroll position while the new book fetches; the pending-jump
    // effect takes over once content for the new book has loaded.
    scrollQueue.enqueueAbsolute(() => 0, { coalesceKey: "chapter-jump", suppressTracking: true, instant: true });
    cancelCommand();
  };

  // Handle Tab key for autocomplete
  const handleBookAutocomplete = () => {
    if (bookAutocomplete) {
      setInputBuffer(bookAutocomplete);
    }
  };

  // Reset highlighter to first verse when the book actually changes (not on
  // the initial load of a persisted book, which should keep no highlight
  // until the reader moves it, so the saved chapter position isn't clobbered)
  const previousBookRef = useRef<string | null>(null);
  useEffect(() => {
    if (Object.keys(content).length === 0) {
      return;
    }
    const bookChanged = previousBookRef.current !== null && previousBookRef.current !== settings.currentBook;
    previousBookRef.current = settings.currentBook;
    if (!bookChanged) {
      return;
    }
    // A cross-book bookmark/go-to-book jump owns the highlight; don't reset it
    // to verse 1 (the content-keyed jump effect below will set the target
    // verse). Every cross-book navigation path stashes a pendingJumpRef, so
    // this branch is only reachable if some future caller changes the book
    // directly without going through that mechanism.
    if (pendingJumpRef.current) {
      return;
    }
    const firstChapterKey = Object.keys(content)[0];
    const firstVerse = firstVerseNumber(content[firstChapterKey]);
    if (firstVerse) {
      setHighlightedVerse({
        chapter: parseInt(firstChapterKey, 10),
        verse: firstVerse,
      });
    }
  }, [settings.currentBook, content]);

  // Complete a pending cross-book bookmark jump once the target book's content
  // has actually loaded. Keyed on `content` so it runs after the fetch effect
  // swaps in the new book. Gated on contentBookRef (the book `content` really
  // holds) - NOT settings.currentBook, which flips synchronously ahead of the
  // async fetch and would let this fire against the OLD book's content. A stale
  // chapter is dropped gracefully (no crash).
  useEffect(() => {
    // Gate on contentBookRef (the book `content` really holds), NOT
    // settings.currentBook, which flips synchronously ahead of the async fetch
    // and would let this fire against the OLD book's content. See
    // decidePendingJump for the pure decision (unit-tested).
    const decision = decidePendingJump(
      pendingJumpRef.current,
      contentBookRef.current,
      Object.keys(content)
    );
    switch (decision.action) {
      case "none":
        return;
      case "abandon":
        // Content loaded for a book other than the pending target: a newer
        // navigation superseded this jump. Clear the ref so the previousBookRef
        // guard below doesn't stay armed forever. Symmetric with the fetch's
        // isStale guard - contentBookRef only holds the latest loaded book.
        pendingJumpRef.current = null;
        return;
      case "drop-stale":
        pendingJumpRef.current = null; // target chapter absent -> drop, no crash
        return;
      case "complete": {
        // Suppress the initial-chapter-scroll effect for this commit: the fetch
        // `.then` reset the flag to false, but this jump owns the scroll and
        // targets a verse (or chapter), not necessarily the chapter top.
        // Setting it true here (this effect runs before the initial-scroll
        // effect, defined later) stops that effect from enqueuing a
        // competing chapter-top scroll.
        hasScrolledToInitialChapter.current = true;
        if (decision.verse) {
          setHighlightedVerse({ chapter: decision.chapter, verse: decision.verse });
          scrollVerseIntoCenter(decision.chapter, decision.verse, { instant: decision.instant });
        } else {
          // Chapter-only jump (e.g. "Geneza 3" cross-book): no target verse
          // was known, so scroll to the chapter and highlight its first verse.
          const chapterKey = String(decision.chapter);
          smoothScrollToChapter(chapterKey, { instant: decision.instant });
          const firstVerse = firstVerseNumber(content[chapterKey]);
          if (firstVerse) {
            setHighlightedVerse({ chapter: decision.chapter, verse: firstVerse });
          }
        }
        pendingJumpRef.current = null;
        return;
      }
    }
  }, [content, scrollVerseIntoCenter]);

  // Track if initial scroll has been performed
  const hasScrolledToInitialChapter = useRef(false);

  // Ref to track current chapter for Intersection Observer (avoids stale closures)
  const currentChapterRef = useRef(settings.currentChapter);

  // Load book content when book changes
  useEffect(() => {
    if (!settings.currentBook) {
      return;
    }
    // Guards against a slower response for a book the reader has since
    // navigated away from overwriting the content of the current book
    let isStale = false;
    fetch(
      `/api/bible?book=${encodeURIComponent(settings.currentBook)}&version=${settings.currentTranslation}`
    )
      .then((response) => response.json())
      .then((data) => {
        if (isStale) return;
        if (data?.error) {
          console.error("Failed to load book:", data.error);
          showToast(`Could not load ${settings.currentBook}`);
          // Drop any pending jump aimed at this book, and revert the title to
          // the book still on screen, so a missing book doesn't leave a
          // title/content mismatch or a leaked ref that arms the jump guard.
          pendingJumpRef.current = null;
          if (contentBookRef.current && contentBookRef.current !== settings.currentBook) {
            setSetting("currentBook", contentBookRef.current);
          }
          return;
        }
        setContent(data);
        // Record which book `content` now holds (the jump effect gates on this).
        contentBookRef.current = settings.currentBook;
        // Reset scroll flag when book changes
        hasScrolledToInitialChapter.current = false;
      })
      .catch((error) => {
        if (!isStale) {
          console.error("Failed to fetch book content:", error);
        }
      });
    return () => {
      isStale = true;
    };
  }, [settings.currentBook, settings.currentTranslation, showToast, setSetting]);

  // Scroll to saved currentChapter on initial page load
  useEffect(() => {
    // Only scroll once when content is first loaded
    if (!hasScrolledToInitialChapter.current && Object.keys(content).length > 0 && settings.currentChapter) {
      const chapterKey = settings.currentChapter.toString();
      // Check if chapter exists in content
      if (content[chapterKey]) {
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
          smoothScrollToChapter(chapterKey);
          hasScrolledToInitialChapter.current = true;
        }, 100);
      }
    }
  }, [content, settings.currentChapter]);

  // Update ref when currentChapter changes
  useEffect(() => {
    currentChapterRef.current = settings.currentChapter;
  }, [settings.currentChapter]);

  const headerSentinelRef = useRef<HTMLDivElement>(null);
  const [isHeaderOffscreen, setIsHeaderOffscreen] = useState(false);

  // Intersection Observer to track visible chapter
  useEffect(() => {
    if (Object.keys(content).length === 0) {
      return;
    }

    const observerOptions = {
      root: null, // viewport
      rootMargin: '-20% 0px -50% 0px', // Trigger when chapter is in upper portion of viewport
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0], // Multiple thresholds for better detection
    };

    const observer = new IntersectionObserver((entries) => {
      // Skip updates if we're programmatically scrolling
      if (scrollQueue.isChapterTrackingSuppressed()) {
        return;
      }

      // Find the chapter occupying the most of the visible reading band, by
      // absolute intersecting height rather than intersectionRatio (a ratio
      // relative to each chapter's own height unfairly favors short chapters
      // over long ones that only partially overlap the band)
      let maxIntersectionHeight = 0;
      let visibleChapter: number | null = null;

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRect.height > maxIntersectionHeight) {
          maxIntersectionHeight = entry.intersectionRect.height;
          const chapterId = entry.target.id;
          const chapterNum = parseInt(chapterId.replace('chapter-', ''), 10);
          if (!isNaN(chapterNum)) {
            visibleChapter = chapterNum;
          }
        }
      });

      // Update currentChapter if we found a visible chapter and it's different
      if (visibleChapter !== null && visibleChapter !== currentChapterRef.current) {
        // Use requestAnimationFrame to ensure DOM is ready and batch updates
        requestAnimationFrame(() => {
          if (!scrollQueue.isChapterTrackingSuppressed() && visibleChapter !== null) {
            setSetting("currentChapter", visibleChapter);
          }
        });
      }
    }, observerOptions);

    // Wait a bit for DOM to be ready, then observe all chapter elements
    const timeoutId = setTimeout(() => {
      const chapterElements = Object.keys(content).map((chapterKey) =>
        document.getElementById(`chapter-${chapterKey}`)
      ).filter((el): el is HTMLElement => el !== null);

      chapterElements.forEach((element) => {
        observer.observe(element);
      });
    }, 200);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, [content, setSetting]);

  // Intersection Observer to show/hide the sticky mini header once the main
  // header (book title + translation badge) scrolls out of view. Deliberately
  // separate from the chapter-tracking observer above: different target,
  // different lifecycle (this one never needs to re-run per chapter load).
  useEffect(() => {
    const sentinel = headerSentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setIsHeaderOffscreen(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    }, { threshold: 0 });

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      <StickyHeader
        bookName={settings.currentBook}
        translationCode={settings.currentTranslation}
        translationLabel={TRANSLATION_LABELS[settings.currentTranslation]}
        visible={isHeaderOffscreen}
      />
      <div
        className={styles.container}
        style={{ maxWidth: `min(${settings.contentWidth}px, calc(100vw - ${CONTENT_WIDTH_MARGIN}px))` }}
      >
        <h1>{settings.currentBook}</h1>
        <div
          className={styles.translationBadge}
          title={TRANSLATION_LABELS[settings.currentTranslation]}
        >
          {settings.currentTranslation}
        </div>
        <div ref={headerSentinelRef} />
        <div className={styles.content} ref={contentRef}>
          <Book
            book={content}
            showChapterNumbers={settings.showChapterNumbers}
            showVerseNumbers={settings.showVerseNumbers}
            highlightedVerse={highlightedVerse}
            showVerseHighlighter={settings.showVerseHighlighter}
            bookmarkedVerseKeys={bookmarkedVerseKeys}
            onVerseClick={handleVerseClick}
          />
        </div>
      </div>
      <VisibilityModal
        isOpen={isVisibilityModalOpen}
        settings={{
          showChapterNumbers: settings.showChapterNumbers,
          showVerseNumbers: settings.showVerseNumbers,
          showVerseHighlighter: settings.showVerseHighlighter,
        }}
        onToggle={handleToggleVisibility}
        onClose={handleCloseVisibilityModal}
      />
      <CommandModal
        isOpen={activeMode === "goto-chapter"}
        prompt="Go to chapter:"
        value={inputBuffer}
        onChange={setInputBuffer}
        onSubmit={handleGoToChapter}
        onCancel={cancelCommand}
      />
      <CommandModal
        isOpen={activeMode === "goto-book"}
        prompt="Go to book:"
        value={inputBuffer}
        onChange={setInputBuffer}
        onSubmit={handleGoToBook}
        onCancel={cancelCommand}
        autocomplete={bookAutocomplete}
        onTab={handleBookAutocomplete}
      />
      <BookmarksModal
        isOpen={activeMode === "bookmarks"}
        bookmarks={settings.bookmarks}
        onJump={handleBookmarkJump}
        onDelete={(b) => removeBookmark(b.book, b.chapter, b.verse)}
        onClose={cancelCommand}
      />
      <TranslationModal
        isOpen={activeMode === "translation"}
        current={settings.currentTranslation}
        onSelect={(t) => setSetting("currentTranslation", t)}
        onClose={cancelCommand}
      />
      <Toast message={toast} />
    </>
  );
}
