"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styles from "./page.module.css";
import { useKeyboardCommands } from "@/hooks/useKeyboardCommands";
import VisibilityModal from "@/components/VisibilityModal";
import CommandModal from "@/components/CommandModal";
import { useSettings } from "@/context/SettingsContext";
import books from "@/data/books.json";
import { findBestMatch } from "@/utils/fuzzySearch";

/**
 * Smooth-scrolls to a chapter, and marks the scroll as programmatic for the
 * duration of the scroll so the IntersectionObserver ignores it.
 * @param chapterNumber - Chapter key (e.g. "3") whose element to scroll to.
 * @param scrollGuardRef - Ref tracking programmatic-scroll state and its pending reset timer.
 * @returns void
 */
function smoothScrollToChapter(
  chapterNumber: string,
  scrollGuardRef?: React.MutableRefObject<{ isScrolling: boolean; resetTimeoutId: ReturnType<typeof setTimeout> | null }>
) {
  if (scrollGuardRef) {
    if (scrollGuardRef.current.resetTimeoutId !== null) {
      clearTimeout(scrollGuardRef.current.resetTimeoutId);
    }
    scrollGuardRef.current.isScrolling = true;
  }
  window.scrollTo({
    top: (document.getElementById(`chapter-${chapterNumber}`)?.offsetTop ?? 0) - 30,
    behavior: 'smooth'
  });
  // Reset flag after scroll completes (smooth scroll takes ~500ms)
  if (scrollGuardRef) {
    scrollGuardRef.current.resetTimeoutId = setTimeout(() => {
      scrollGuardRef.current.isScrolling = false;
      scrollGuardRef.current.resetTimeoutId = null;
    }, 600);
  }
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
  }, [activeMode, allVerses]);

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
  }, [activeMode, allVerses]);

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

    const currentChapter = settings.currentChapter;
    const nextChapter = currentChapter + 1;
    const chapterKey = nextChapter.toString();

    // Check if next chapter exists in current book
    if (content[chapterKey]) {
      // Update current chapter in settings
      setSetting("currentChapter", nextChapter);
      // Scroll to chapter
      smoothScrollToChapter(chapterKey, scrollGuardRef);
      // Reset verse highlighter to first verse of new chapter
      const firstVerse = content[chapterKey][0];
      if (firstVerse) {
        setHighlightedVerse({ chapter: nextChapter, verse: firstVerse.number });
      }
    }
    // If at last chapter, do nothing
  }, [activeMode, settings.currentChapter, content, setSetting]);

  const handleGoToPreviousChapter = useCallback(() => {
    // Only work when no modal is open
    if (activeMode !== null) {
      return;
    }

    const currentChapter = settings.currentChapter;
    const prevChapter = currentChapter - 1;
    const chapterKey = prevChapter.toString();

    // Check if previous chapter exists in current book
    if (prevChapter > 0 && content[chapterKey]) {
      // Update current chapter in settings
      setSetting("currentChapter", prevChapter);
      // Scroll to chapter
      smoothScrollToChapter(chapterKey, scrollGuardRef);
      // Reset verse highlighter to first verse of new chapter
      const firstVerse = content[chapterKey][0];
      if (firstVerse) {
        setHighlightedVerse({ chapter: prevChapter, verse: firstVerse.number });
      }
    }
    // If at first chapter, do nothing
  }, [activeMode, settings.currentChapter, content, setSetting]);

  // Auto-scroll when highlighted verse moves off-screen
  useEffect(() => {
    if (!highlightedVerse || !settings.showVerseHighlighter || !contentRef.current) {
      return;
    }

    // Find the highlighted verse element
    const verseElement = contentRef.current.querySelector(
      `[data-chapter="${highlightedVerse.chapter}"][data-verse="${highlightedVerse.verse}"]`
    ) as HTMLElement | null;

    if (!verseElement) return;

    const rect = verseElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const padding = 100;

    // Check if verse is below viewport
    if (rect.bottom > viewportHeight - padding) {
      const scrollAmount = rect.bottom - viewportHeight + padding + 50;
      window.scrollTo({
        top: window.scrollY + scrollAmount,
        behavior: "smooth",
      });
    }
    // Check if verse is above viewport
    else if (rect.top < padding) {
      const scrollAmount = rect.top - padding;
      window.scrollTo({
        top: window.scrollY + scrollAmount,
        behavior: "smooth",
      });
    }
  }, [highlightedVerse, settings.showVerseHighlighter]);

  // Register commands
  useEffect(() => {
    registerCommand({
      key: "v",
      type: "modal",
      mode: "visibility",
    });
    registerCommand({
      key: "g",
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
      key: "h",
      type: "single",
      handler: handleGoToPreviousChapter,
    });
    registerCommand({
      key: "l",
      type: "single",
      handler: handleGoToNextChapter,
    });
  }, [registerCommand, handleMoveHighlighterDown, handleMoveHighlighterUp, handleGoToPreviousChapter, handleGoToNextChapter]);

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
        smoothScrollToChapter(chapterKey, scrollGuardRef);
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
      window.scrollTo({ top: 0, behavior: "smooth" });
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
  
  // Track if we're programmatically scrolling to avoid updating currentChapter
  const scrollGuardRef = useRef<{ isScrolling: boolean; resetTimeoutId: ReturnType<typeof setTimeout> | null }>({
    isScrolling: false,
    resetTimeoutId: null,
  });
  
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
          smoothScrollToChapter(chapterKey, scrollGuardRef);
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
      if (scrollGuardRef.current.isScrolling) {
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
          if (!scrollGuardRef.current.isScrolling && visibleChapter !== null) {
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
      <div className={styles.container}>
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
