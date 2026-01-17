"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import styles from "./page.module.css";
import { useKeyboardCommands } from "@/hooks/useKeyboardCommands";
import VisibilityModal from "@/components/VisibilityModal";
import CommandModal from "@/components/CommandModal";
import { useSettings } from "@/context/SettingsContext";
import books from "@/data/books.json";
import { findBestMatch } from "@/utils/fuzzySearch";

function smoothScrollToChapter(chapterNumber: string) {
  window.scrollTo({
    top: (document.getElementById(`chapter-${chapterNumber}`)?.offsetTop ?? 0) - 30,
    behavior: 'smooth'
  });
}

function Chapter({ 
  chapter, 
  showVerseNumbers 
}: { 
  chapter: { number: number; text: string }[];
  showVerseNumbers: boolean;
}) {
  return (
    <>
      {chapter.map((data) => (
        <span key={data.number}>
          {showVerseNumbers && (
            <sup className={styles.verseNumber}>{data.number}</sup>
          )}
          <span dangerouslySetInnerHTML={{ __html: `${data.text} ` }}></span>
        </span>
      ))}
    </>
  );
}

function Book({
  book,
  showChapterNumbers,
  showVerseNumbers,
}: {
  book: { [key: string]: { number: number; text: string }[] };
  showChapterNumbers: boolean;
  showVerseNumbers: boolean;
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
            <Chapter chapter={chapter} showVerseNumbers={showVerseNumbers} />
          </p>
        );
      })}
    </>
  );
}

export default function Home() {
  const [content, setContent] = useState<{
    [key: string]: { number: number; text: string }[];
  }>({});
  
  // Settings from context
  const { settings, toggleSetting, setSetting } = useSettings();
  const [isVisibilityModalOpen, setIsVisibilityModalOpen] = useState(false);

  // Line highlighter state
  const [highlighterLineIndex, setHighlighterLineIndex] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState<number>(0);
  const [contentTopOffset, setContentTopOffset] = useState<number>(0);
  const [totalLines, setTotalLines] = useState<number>(0);

  // Keyboard commands hook
  const { activeMode, inputBuffer, registerCommand, cancelCommand, setInputBuffer } = useKeyboardCommands();

  // Handle line highlighter navigation
  const handleMoveHighlighterDown = useCallback(() => {
    // Only work when line highlighter is enabled and no modal is open
    if (!settings.showLineHighlighter || activeMode !== null) {
      return;
    }
    
    setHighlighterLineIndex((prev) => {
      const newIndex = Math.min(prev + 1, totalLines - 1);
      return newIndex;
    });
  }, [settings.showLineHighlighter, activeMode, totalLines]);

  const handleMoveHighlighterUp = useCallback(() => {
    // Only work when line highlighter is enabled and no modal is open
    if (!settings.showLineHighlighter || activeMode !== null) {
      return;
    }
    
    setHighlighterLineIndex((prev) => {
      const newIndex = Math.max(prev - 1, 0);
      return newIndex;
    });
  }, [settings.showLineHighlighter, activeMode]);

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
      smoothScrollToChapter(chapterKey);
      // Reset line highlighter to first line
      setHighlighterLineIndex(0);
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
      smoothScrollToChapter(chapterKey);
      // Reset line highlighter to first line
      setHighlighterLineIndex(0);
    }
    // If at first chapter, do nothing
  }, [activeMode, settings.currentChapter, content, setSetting]);

  // Auto-scroll when highlighter moves off-screen
  useEffect(() => {
    if (!settings.showLineHighlighter || lineHeight === 0 || !contentRef.current) {
      return;
    }

    const highlighterY = contentTopOffset + (highlighterLineIndex * lineHeight);
    const contentRect = contentRef.current.getBoundingClientRect();
    
    // Calculate highlighter position relative to viewport
    const highlighterViewportY = contentRect.top + highlighterY;

    // Check if highlighter is below viewport (with 100px padding from bottom)
    if (highlighterViewportY + lineHeight > window.innerHeight - 100) {
      // Scroll down so highlighter is near bottom (with padding)
      const scrollAmount = highlighterViewportY + lineHeight - window.innerHeight + 150;
      window.scrollTo({
        top: window.scrollY + scrollAmount,
        behavior: "smooth",
      });
    }
    // Check if highlighter is above viewport (with 100px padding from top)
    else if (highlighterViewportY < 100) {
      // Scroll up so highlighter is near top (with padding)
      const scrollAmount = highlighterViewportY - 100;
      window.scrollTo({
        top: window.scrollY + scrollAmount,
        behavior: "smooth",
      });
    }
  }, [highlighterLineIndex, settings.showLineHighlighter, lineHeight, contentTopOffset]);

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
    setting: "showChapterNumbers" | "showVerseNumbers" | "showLineHighlighter"
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

  // Calculate line height from CSS and content offset
  useEffect(() => {
    if (contentRef.current) {
      const firstParagraph = contentRef.current.querySelector("p");
      if (firstParagraph) {
        const computedStyle = window.getComputedStyle(firstParagraph);
        const fontSize = parseFloat(computedStyle.fontSize);
        const lineHeightValue = parseFloat(computedStyle.lineHeight);
        // If line-height is a number (not "normal"), use it directly
        // Otherwise calculate from font-size * 2.2 (from globals.css)
        const calculatedLineHeight = isNaN(lineHeightValue) 
          ? fontSize * 2.2 
          : lineHeightValue;
        setLineHeight(calculatedLineHeight);
        
        // Calculate the offset from content top to first paragraph top
        const contentRect = contentRef.current.getBoundingClientRect();
        const paragraphRect = firstParagraph.getBoundingClientRect();
        const offset = paragraphRect.top - contentRect.top;
        setContentTopOffset(offset);
      }
    }
  }, [content]);

  // Calculate total number of lines in content
  useEffect(() => {
    if (contentRef.current && lineHeight > 0) {
      const contentHeight = contentRef.current.scrollHeight;
      const calculatedTotalLines = Math.floor((contentHeight - contentTopOffset) / lineHeight);
      setTotalLines(Math.max(0, calculatedTotalLines));
    }
  }, [content, lineHeight, contentTopOffset]);

  // Reset highlighter when book or chapter changes
  useEffect(() => {
    setHighlighterLineIndex(0);
  }, [settings.currentBook, settings.currentChapter]);

  // Load book content when book changes
  useEffect(() => {
    if (settings.currentBook) {
      fetch("/api/bible?book=" + settings.currentBook)
        .then((response) => response.json())
        .then((data) => {
          setContent(data);
        });
    }
  }, [settings.currentBook]);

  // Calculate highlighter Y position (accounting for content offset)
  const highlighterY = contentTopOffset + (highlighterLineIndex * lineHeight);

  return (
    <>
      <div className={styles.container}>
        <h1>{settings.currentBook}</h1>
        <div className={styles.content} ref={contentRef}>
          {settings.showLineHighlighter && lineHeight > 0 && (
            <div
              className={styles.lineHighlighter}
              style={{
                top: `${highlighterY}px`,
                height: `${lineHeight}px`,
              }}
            />
          )}
          <Book 
            book={content} 
            showChapterNumbers={settings.showChapterNumbers}
            showVerseNumbers={settings.showVerseNumbers}
          />
        </div>
      </div>
      <VisibilityModal
        isOpen={isVisibilityModalOpen}
        settings={{
          showChapterNumbers: settings.showChapterNumbers,
          showVerseNumbers: settings.showVerseNumbers,
          showLineHighlighter: settings.showLineHighlighter,
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
