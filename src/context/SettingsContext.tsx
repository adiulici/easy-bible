"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import {
  toggleBookmarkInList,
  removeBookmarkFromList,
  type Bookmark,
} from "@/utils/bookmarks";

export type { Bookmark };

export interface Settings {
  showChapterNumbers: boolean;
  showVerseNumbers: boolean;
  showVerseHighlighter: boolean;
  currentBook: string;
  currentChapter: number;
  contentWidth: number;
  bookmarks: Bookmark[];
}

const defaultSettings: Settings = {
  showChapterNumbers: true,
  showVerseNumbers: false,
  showVerseHighlighter: false,
  currentBook: "Geneza",
  currentChapter: 1,
  contentWidth: 800,
  bookmarks: [],
};

const STORAGE_KEY = "biblia-settings";

interface SettingsContextType {
  settings: Settings;
  toggleSetting: (key: keyof Pick<Settings, "showChapterNumbers" | "showVerseNumbers" | "showVerseHighlighter">) => void;
  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  toggleBookmark: (entry: Bookmark) => void;
  removeBookmark: (book: string, chapter: number, verse: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save settings to localStorage on every change
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }, [settings, isLoaded]);

  /**
   * Flips a boolean setting.
   * @param key - Key of the boolean setting to toggle.
   * @returns void
   */
  const toggleSetting = useCallback(
    (key: keyof Pick<Settings, "showChapterNumbers" | "showVerseNumbers" | "showVerseHighlighter">) => {
      setSettings((prev) => ({
        ...prev,
        [key]: !prev[key],
      }));
    },
    []
  );

  /**
   * Updates a single setting to a new value.
   * @param key - Key of the setting to update.
   * @param value - New value for that setting.
   * @returns void
   */
  const setSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  /**
   * Adds a bookmark, or removes it if the same (book, chapter, verse) tuple is
   * already bookmarked (toggle). Wraps the pure list util immutably.
   * @param entry - Bookmark to toggle.
   * @returns void
   */
  const toggleBookmark = useCallback((entry: Bookmark) => {
    setSettings((prev) => ({
      ...prev,
      bookmarks: toggleBookmarkInList(prev.bookmarks, entry),
    }));
  }, []);

  /**
   * Removes the bookmark matching a (book, chapter, verse) tuple, if present.
   * @param book - Book name to match.
   * @param chapter - Chapter number to match.
   * @param verse - Verse number key to match.
   * @returns void
   */
  const removeBookmark = useCallback((book: string, chapter: number, verse: string) => {
    setSettings((prev) => ({
      ...prev,
      bookmarks: removeBookmarkFromList(prev.bookmarks, book, chapter, verse),
    }));
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, toggleSetting, setSetting, toggleBookmark, removeBookmark }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
