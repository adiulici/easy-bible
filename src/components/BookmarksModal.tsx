"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./BookmarksModal.module.css";
import { bookmarkId, type Bookmark } from "@/utils/bookmarks";

interface BookmarksModalProps {
  isOpen: boolean;
  /** Bookmarks to list, already ordered newest-first. */
  bookmarks: Bookmark[];
  onJump: (bookmark: Bookmark) => void;
  onDelete: (bookmark: Bookmark) => void;
  onClose: () => void;
}

/**
 * Modal listing all bookmarks (newest-first) with keyboard + mouse navigation.
 * Mirrors VisibilityModal: capture-phase keydown while open so keys never leak
 * to the global command hook. j/k move selection, Enter jumps + closes, x
 * deletes (list stays open), Esc closes. Rows are clickable (click = jump) with
 * a per-row delete affordance.
 * @param isOpen - Whether the modal is shown.
 * @param bookmarks - Bookmarks to render, newest-first.
 * @param onJump - Called with the chosen bookmark to navigate to it.
 * @param onDelete - Called with the bookmark to remove.
 * @param onClose - Called to dismiss the modal.
 * @returns The modal element, or null when closed.
 */
export default function BookmarksModal({
  isOpen,
  bookmarks,
  onJump,
  onDelete,
  onClose,
}: BookmarksModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Mirror of selectedIndex read by the keydown handler, so the capture-phase
  // listener subscribes once per open instead of re-subscribing on every j/k.
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  // Reset selection to the top each time the modal opens.
  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keep the selection within bounds when the list shrinks (e.g. after delete).
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (bookmarks.length === 0) return 0;
      return Math.min(prev, bookmarks.length - 1);
    });
  }, [bookmarks.length]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      // j/k/Enter/x are all "handled" keys: swallow them (preventDefault +
      // stopPropagation) even when the list is empty, so they never leak to the
      // global command hook while this modal is open. The empty list simply has
      // no action to perform.
      if (
        event.key === "j" ||
        event.key === "k" ||
        event.key === "Enter" ||
        event.key === "x"
      ) {
        event.preventDefault();
        event.stopPropagation();

        if (bookmarks.length === 0) {
          return;
        }

        if (event.key === "j") {
          setSelectedIndex((prev) => Math.min(prev + 1, bookmarks.length - 1));
        } else if (event.key === "k") {
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (event.key === "Enter") {
          const target = bookmarks[selectedIndexRef.current];
          if (target) {
            onJump(target);
            onClose();
          }
        } else if (event.key === "x") {
          const target = bookmarks[selectedIndexRef.current];
          if (target) {
            onDelete(target);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // capture phase
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen, bookmarks, onJump, onDelete, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {bookmarks.length === 0 ? (
          <p className={styles.empty}>No bookmarks yet.</p>
        ) : (
          <ul className={styles.list}>
            {bookmarks.map((bookmark, index) => (
              <li
                key={bookmarkId(bookmark.book, bookmark.chapter, bookmark.verse)}
                className={`${styles.row} ${index === selectedIndex ? styles.selected : ""}`}
              >
                <button
                  type="button"
                  className={styles.rowBody}
                  onClick={() => {
                    onJump(bookmark);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className={styles.reference}>
                    {bookmark.book} {bookmark.chapter}:{bookmark.verse}
                  </span>
                  <span className={styles.snippet}>{bookmark.text}</span>
                </button>
                <button
                  type="button"
                  className={styles.delete}
                  aria-label="Delete bookmark"
                  onClick={() => onDelete(bookmark)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
