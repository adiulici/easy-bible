"use client";
import { useEffect } from "react";
import styles from "./VisibilityModal.module.css";

export interface VisibilitySettings {
  showChapterNumbers: boolean;
  showVerseNumbers: boolean;
  showVerseHighlighter: boolean;
}

interface VisibilityModalProps {
  isOpen: boolean;
  settings: VisibilitySettings;
  onToggle: (setting: keyof VisibilitySettings) => void;
  onClose: () => void;
}

const defer = (fn: () => void) => {
  setTimeout(fn, 0);
};

export default function VisibilityModal({
  isOpen,
  settings,
  onToggle,
  onClose,
}: VisibilityModalProps) {
  // Handle keyboard events
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      // Handle shortcut keys for toggling options (case-insensitive)
      const key = event.key.toLowerCase();
      if (key === "c") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        defer(() => onToggle("showChapterNumbers"));
      } else if (key === "v") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        defer(() => onToggle("showVerseNumbers"));
      } else if (key === "h") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        defer(() => onToggle("showVerseHighlighter"));
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // Use capture phase
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onToggle, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.content}>
          <div
            className={styles.option}
            onClick={() => {
              onToggle("showChapterNumbers");
              onClose();
            }}
          >
            <span className={`${styles.checkbox} ${settings.showChapterNumbers ? styles.checked : ''}`}>
              {settings.showChapterNumbers ? "×" : ""}
            </span>
            <span className={styles.label}>Chapter numbers</span>
            <span className={styles.shortcut}>c</span>
          </div>
          <div
            className={styles.option}
            onClick={() => {
              onToggle("showVerseNumbers");
              onClose();
            }}
          >
            <span className={`${styles.checkbox} ${settings.showVerseNumbers ? styles.checked : ''}`}>
              {settings.showVerseNumbers ? "×" : ""}
            </span>
            <span className={styles.label}>Verse numbers</span>
            <span className={styles.shortcut}>v</span>
          </div>
          <div
            className={styles.option}
            onClick={() => {
              onToggle("showVerseHighlighter");
              onClose();
            }}
          >
            <span className={`${styles.checkbox} ${settings.showVerseHighlighter ? styles.checked : ''}`}>
              {settings.showVerseHighlighter ? "×" : ""}
            </span>
            <span className={styles.label}>Verse highlighter</span>
            <span className={styles.shortcut}>h</span>
          </div>
        </div>
      </div>
    </div>
  );
}
