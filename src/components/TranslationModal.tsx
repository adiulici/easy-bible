"use client";
import { useEffect } from "react";
import styles from "./TranslationModal.module.css";
import { TRANSLATIONS, TRANSLATION_LABELS, type Translation } from "@/types/bible";

interface TranslationModalProps {
  isOpen: boolean;
  current: Translation;
  onSelect: (translation: Translation) => void;
  onClose: () => void;
}

const defer = (fn: () => void) => {
  setTimeout(fn, 0);
};

/**
 * Modal for switching the active Bible translation. Mirrors VisibilityModal:
 * capture-phase keydown while open so number shortcuts never leak to the global
 * command hook. Each translation gets a numeric shortcut (1, 2, …); Esc closes.
 * @param isOpen - Whether the modal is shown.
 * @param current - The currently active translation.
 * @param onSelect - Called with the chosen translation.
 * @param onClose - Called to dismiss the modal.
 * @returns The modal element, or null when closed.
 */
export default function TranslationModal({
  isOpen,
  current,
  onSelect,
  onClose,
}: TranslationModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      const index = parseInt(event.key, 10) - 1;
      if (!Number.isNaN(index) && index >= 0 && index < TRANSLATIONS.length) {
        event.preventDefault();
        event.stopPropagation();
        const chosen = TRANSLATIONS[index];
        onClose();
        defer(() => onSelect(chosen));
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // capture phase
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, onSelect, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.content}>
          {TRANSLATIONS.map((translation, index) => {
            const isCurrent = translation === current;
            return (
              <button
                type="button"
                key={translation}
                className={styles.option}
                aria-pressed={isCurrent}
                onClick={() => {
                  onSelect(translation);
                  onClose();
                }}
              >
                <span className={`${styles.radio} ${isCurrent ? styles.checked : ""}`}>
                  {isCurrent ? "●" : ""}
                </span>
                <span className={styles.labels}>
                  <span className={styles.code}>{translation}</span>
                  <span className={styles.name}>{TRANSLATION_LABELS[translation]}</span>
                </span>
                <span className={styles.shortcut}>{index + 1}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
