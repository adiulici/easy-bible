"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styles from "./page.module.css";
import { useKeyboardCommands } from "@/hooks/useKeyboardCommands";
import VisibilityModal from "@/components/VisibilityModal";
import CommandModal from "@/components/CommandModal";
import { useSettings } from "@/context/SettingsContext";
import books from "@/data/books.json";
import { findBestMatch } from "@/utils/fuzzySearch";
import { createScrollQueue } from "@/utils/scrollQueue";

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
 * Queues a smooth scroll to a chapter. Coalesced with any other pending
 * chapter jump so rapid-fire navigation ends up as one glide to the final
 * target instead of a stack of interrupted animations.
 * @param chapterNumber - Chapter key (e.g. "3") whose element to scroll to.
 * @returns void
 */
function smoothScrollToChapter(chapterNumber: string) {
  scrollQueue.enqueueAbsolute(() => getChapterScrollY(chapterNumber), {
    coalesceKey: "chapter-jump",
    suppressTracking: true,
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

function Chapter({
  chapter,
  chapterNumber,
  showVerseNumbers,
  highlightedVerse,
  showVerseHighlighter,
  onVerseClick,
}: { 
  chapter: { number: string; text: string }[];
  chapterNumber: number;
  showVerseNumbers: boolean;
  highlightedVerse: { chapter: number; verse: string } | null;
  showVerseHighlighter: boolean;
  onVerseClick: (chapter: number, verse: string) => void;
}) {
  return (
    <>
      {chapter.map((data) => {
        const isHighlighted = highlightedVerse?.chapter === chapterNumber && 
                              highlightedVerse?.verse === data.number;
        return (
          <span 
            key={data.number}
            data-chapter={chapterNumber}
            data-verse={data.number}
            className={`${styles.verse} ${showVerseHighlighter && isHighlighted ? styles.verseHighlighted : ''}`}
            onClick={() => onVerseClick(chapterNumber, data.number)}
          >
            {showVerseNumbers && (
              <sup className={styles.verseNumber}>{data.number}</sup>
            )}
            <span dangerouslySetInnerHTML={{ __html: `${data.text} ` }}></span>
          </span>
        );
      })}
    </>
  );
}

function Book({
  book,
  showChapterNumbers,
  showVerseNumbers,
  highlightedVerse,
  showVerseHighlighter,
  onVerseClick,
}: {
  book: { [key: string]: { number: string; text: string }[] };
  showChapterNumbers: boolean;
  showVerseNumbers: boolean;
  highlightedVerse: { chapter: number; verse: string } | null;
  showVerseHighlighter: boolean;
  onVerseClick: (chapter: number, verse: string) => void;
}) {
  return (
    <>
      {Object.entries(book).map(([chapterKey, chapter]) => {
        const chapterNum = parseInt(chapterKey, 10);
        return (
          <p key={chapterKey} id={`chapter-${chapterKey}`}>
            {showChapterNumbers && (
              <span className={styles.chapter}>{chapterNum}.</span>
            )}
            <Chapter 
              chapter={chapter} 
              chapterNumber={chapterNum}
              showVerseNumbers={showVerseNumbers}
              highlightedVerse={highlightedVerse}
              showVerseHighlighter={showVerseHighlighter}
              onVerseClick={onVerseClick}
            />
          </p>
        );
      })}
    </>
  );
}

export default function Home() {
  const [content, setContent] = useState<{
    [key: string]: { number: string; text: string }[];
  }>({});
  
  // Settings from context
  const { settings, toggleSetting, setSetting } = useSettings();
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);

  // Verse highlighter state - tracks current highlighted verse
  const [highlightedVerse, setHighlightedVerse] = useState<{ chapter: number; verse: string } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Ref to track last navigation time for smooth key repeat handling
  const lastNavigationTime = useRef<number>(0);
  const navigationThrottleMs = 50; // Minimum ms between navigation actions

  // Keyboard commands hook
  const { activeMode, inputBuffer, registerCommand, cancelCommand, setInputBuffer } = useKeyboardCommands();

  // Build a flat list of all verses for navigation
  const allVerses = useMemo(() => {
    const verses: { chapter: number; verse: string }[] = [];
    Object.entries(content).forEach(([chapterKey, chapter]) => {
      const chapterNum = parseInt(chapterKey, 10);
      chapter.forEach((v) => {
        verses.push({ chapter: chapterNum, verse: v.number });
      });
    });
    return verses;
  }, [content]);

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
      const firstVerse = content[chapterKey][0];
      if (firstVerse) {
        setHighlightedVerse({ chapter: nextChapter, verse: firstVerse.number });
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
      const firstVerse = content[chapterKey][0];
      if (firstVerse) {
        setHighlightedVerse({ chapter: prevChapter, verse: firstVerse.number });
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
    const firstVerse = content[firstChapterKey][0];
    if (firstVerse) {
      setHighlightedVerse({ chapter: firstChapterNumber, verse: firstVerse.number });
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
    const lastChapterVerses = content[lastChapterKey];
    const lastVerse = lastChapterVerses[lastChapterVerses.length - 1];
    if (lastVerse) {
      setHighlightedVerse({ chapter: lastChapterNumber, verse: lastVerse.number });
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
  }, [registerCommand, handleMoveHighlighterDown, handleMoveHighlighterUp, handlePageUp, handlePageDown, handleGoToTop, handleGoToBottom, handleGoToNextChapter, handleGoToPreviousChapter, handleDecreaseWidth, handleIncreaseWidth]);

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

  // Calculate autocomplete suggestion for book search
  const bookAutocomplete = useMemo(() => {
    if (activeMode !== "goto-book" || !inputBuffer.trim()) {
      return null;
    }
    return findBestMatch(inputBuffer, books as string[]);
  }, [activeMode, inputBuffer]);

  // Handle "Go to Book" command
  const handleGoToBook = () => {
    const input = inputBuffer.trim();
    
    if (!input) {
      cancelCommand();
      return;
    }

    // Find the best matching book
    const matchedBook = findBestMatch(input, books as string[]);
    
    if (matchedBook) {
      // Navigate to the book
      setSetting("currentBook", matchedBook);
      setSetting("currentChapter", 1);
      // Scroll to top
      scrollQueue.enqueueAbsolute(() => 0, { coalesceKey: "chapter-jump", suppressTracking: true });
      // Close modal and clear input
      cancelCommand();
    } else {
      // No match found - just close modal
      cancelCommand();
    }
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
    const firstChapterKey = Object.keys(content)[0];
    const firstChapter = content[firstChapterKey];
    if (firstChapter && firstChapter.length > 0) {
      setHighlightedVerse({
        chapter: parseInt(firstChapterKey, 10),
        verse: firstChapter[0].number,
      });
    }
  }, [settings.currentBook, content]);

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
    fetch("/api/bible?book=" + encodeURIComponent(settings.currentBook))
      .then((response) => response.json())
      .then((data) => {
        if (isStale) return;
        if (data?.error) {
          console.error("Failed to load book:", data.error);
          return;
        }
        setContent(data);
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
  }, [settings.currentBook]);

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

  return (
    <>
      <div
        className={styles.container}
        style={{ maxWidth: `min(${settings.contentWidth}px, calc(100vw - ${CONTENT_WIDTH_MARGIN}px))` }}
      >
        <h1>{settings.currentBook}</h1>
        <div className={styles.content} ref={contentRef}>
          <Book 
            book={content} 
            showChapterNumbers={settings.showChapterNumbers}
            showVerseNumbers={settings.showVerseNumbers}
            highlightedVerse={highlightedVerse}
            showVerseHighlighter={settings.showVerseHighlighter}
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
    </>
  );
}
