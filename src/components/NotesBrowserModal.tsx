"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./NotesBrowserModal.module.css";
import { truncateNoteBody } from "@/utils/notes";
import type { Note } from "@/types/notes";

interface NotesBrowserModalProps {
  isOpen: boolean;
  /** Every note, oldest-first; scope filtering (book vs. all) happens inside. */
  notes: Note[];
  currentBook: string;
  onJump: (note: Note) => void;
  onDelete: (note: Note) => void;
  onClose: () => void;
}

/**
 * Global notes browser (opened with `A`): one row per note, scoped to the
 * current book by default. Mirrors BookmarksModal's capture-phase keydown
 * pattern: j/k select, Enter jumps (parent opens the per-verse panel), x
 * deletes (armed on first press, confirmed on second), f toggles scope
 * between the current book and every book, Esc closes.
 * @param isOpen - Whether the modal is shown.
 * @param notes - Every note, oldest-first.
 * @param currentBook - The book currently being read, for the default scope.
 * @param onJump - Called with the chosen note to navigate to its verse.
 * @param onDelete - Called with the note to remove, once delete is confirmed.
 * @param onClose - Called to dismiss the modal.
 * @returns The modal element, or null when closed.
 */
export default function NotesBrowserModal({
  isOpen,
  notes,
  currentBook,
  onJump,
  onDelete,
  onClose,
}: NotesBrowserModalProps) {
  const [scope, setScope] = useState<"book" | "all">("book");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  const visibleNotes = useMemo(
    () => (scope === "book" ? notes.filter((n) => n.book === currentBook) : notes),
    [notes, scope, currentBook]
  );

  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const visibleNotesRef = useRef(visibleNotes);
  visibleNotesRef.current = visibleNotes;

  useEffect(() => {
    if (isOpen) {
      setScope("book");
      setSelectedIndex(0);
      setPendingDeleteId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex((prev) => {
      if (visibleNotes.length === 0) return 0;
      return Math.min(prev, visibleNotes.length - 1);
    });
  }, [visibleNotes.length]);

  /**
   * Arms deletion of a note on first call, then confirms (and actually
   * deletes) on a second call for the same note. Any other note passed in
   * re-arms for that note instead.
   * @param note - The note to arm or confirm deletion for.
   * @returns Nothing.
   */
  const requestDelete = (note: Note) => {
    if (pendingDeleteId === note.id) {
      onDelete(note);
      setPendingDeleteId(null);
    } else {
      setPendingDeleteId(note.id);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    /**
     * Capture-phase keydown handler for the modal's keyboard shortcuts:
     * Escape closes, f toggles scope, j/k move the selection, Enter jumps
     * to the selected note, x arms/confirms its deletion.
     * @param event - The native keyboard event.
     * @returns Nothing.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === "f") {
        event.preventDefault();
        event.stopPropagation();
        setScope((prev) => (prev === "book" ? "all" : "book"));
        setSelectedIndex(0);
        setPendingDeleteId(null);
        return;
      }

      if (["j", "k", "Enter", "x"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();

        const currentNotes = visibleNotesRef.current;
        if (currentNotes.length === 0) {
          return;
        }

        if (event.key === "j") {
          setPendingDeleteId(null);
          setSelectedIndex((prev) => Math.min(prev + 1, currentNotes.length - 1));
        } else if (event.key === "k") {
          setPendingDeleteId(null);
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (event.key === "Enter") {
          const target = currentNotes[selectedIndexRef.current];
          if (target) {
            onJump(target);
            onClose();
          }
        } else if (event.key === "x") {
          const target = currentNotes[selectedIndexRef.current];
          if (target) {
            requestDelete(target);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose, onJump, onDelete, pendingDeleteId]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          {scope === "book" ? `Notes in ${currentBook}` : "All notes"}
        </div>
        <div className={styles.scopeHint}>
          {scope === "book" ? "Press f for all books" : "Press f for current book"}
        </div>
        {visibleNotes.length === 0 ? (
          <p className={styles.empty}>No notes yet.</p>
        ) : (
          <ul className={styles.list}>
            {visibleNotes.map((note, index) => (
              <li
                key={note.id}
                className={`${styles.row} ${index === selectedIndex ? styles.selected : ""}`}
              >
                <button
                  type="button"
                  className={styles.rowBody}
                  onClick={() => {
                    onJump(note);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className={styles.reference}>
                    {note.book} {note.chapter}:{note.verse}
                  </span>
                  <span className={styles.snippet}>{truncateNoteBody(note.body)}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.delete} ${pendingDeleteId === note.id ? styles.deleteArmed : ""}`}
                  aria-label={pendingDeleteId === note.id ? "Confirm delete note" : "Delete note"}
                  onClick={() => requestDelete(note)}
                >
                  {pendingDeleteId === note.id ? "Confirm?" : "×"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
