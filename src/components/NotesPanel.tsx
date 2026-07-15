"use client";
import { useEffect, useRef, useState } from "react";
import styles from "./NotesPanel.module.css";
import type { Note } from "@/types/notes";

interface NotesPanelProps {
  isOpen: boolean;
  /** Notes for the currently highlighted verse, oldest-first. */
  notes: Note[];
  /** Note to preselect when the panel opens (set by the global notes browser); null selects the first row. */
  focusNoteId: number | null;
  onAdd: (body: string) => void;
  onEdit: (id: number, body: string) => void;
  onDelete: (id: number) => void;
  onClose: () => void;
}

/**
 * Per-verse notes panel (opened with `a`). List view: j/k select, Enter edits
 * the selected note, a starts a new one, x deletes (armed on the first press,
 * confirmed on the second - see pendingDeleteId), Escape closes. Edit view is a
 * plain textarea: Enter submits, Shift+Enter inserts a newline, Escape cancels
 * back to the list without saving.
 * @param isOpen - Whether the panel is shown.
 * @param notes - Notes for the current verse, oldest-first.
 * @param focusNoteId - Note id to preselect on open, or null for the first row.
 * @param onAdd - Called with the body of a newly composed note.
 * @param onEdit - Called with (id, body) when an edited note is submitted.
 * @param onDelete - Called with the id to remove, once delete is confirmed.
 * @param onClose - Called to dismiss the panel.
 * @returns The panel element, or null when closed.
 */
export default function NotesPanel({
  isOpen,
  notes,
  focusNoteId,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: NotesPanelProps) {
  const [viewMode, setViewMode] = useState<"list" | "edit">("list");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const notesRef = useRef(notes);
  notesRef.current = notes;

  // Reset to the list view each time the panel opens, preselecting focusNoteId
  // when it names a note in this verse's list.
  useEffect(() => {
    if (!isOpen) return;
    setViewMode("list");
    setPendingDeleteId(null);
    const index = focusNoteId !== null ? notes.findIndex((n) => n.id === focusNoteId) : -1;
    if (index >= 0) {
      setSelectedIndex(index);
      setPendingFocusId(null);
    } else {
      setSelectedIndex(0);
      setPendingFocusId(focusNoteId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, focusNoteId]);

  /**
   * Resolves a cross-book jump's preselection once the target note actually
   * arrives in `notes` (content for the new book loads asynchronously, so it
   * isn't present on the first render after the panel reopens). No-ops once
   * resolved so it never re-fires on later, unrelated `notes` changes.
   */
  useEffect(() => {
    if (pendingFocusId === null) return;
    const index = notes.findIndex((n) => n.id === pendingFocusId);
    if (index >= 0) {
      setSelectedIndex(index);
      setPendingFocusId(null);
    }
  }, [notes, pendingFocusId]);

  // Keep the selection within bounds when the list shrinks (e.g. after delete).
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (notes.length === 0) return 0;
      return Math.min(prev, notes.length - 1);
    });
  }, [notes.length]);

  useEffect(() => {
    if (viewMode === "edit" && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [viewMode]);

  /**
   * Switches to the edit view for a note (or a new blank note when `id` is
   * null), preloading the draft textarea with `body`. Also clears any pending
   * delete arm, so leaving and returning to the list never finds a stale row
   * armed for deletion.
   * @param id - Id of the note being edited, or null when composing a new note.
   * @param body - Initial textarea contents (empty string for a new note).
   * @returns Nothing.
   */
  const startEdit = (id: number | null, body: string) => {
    setEditingId(id);
    setDraft(body);
    setViewMode("edit");
    setPendingDeleteId(null);
  };

  /**
   * Arms or confirms deletion of a note: the first call for a given `id` arms
   * it (shows the confirm affordance), and a second call for the same `id`
   * calls `onDelete` and clears the armed state.
   * @param id - Id of the note to arm/confirm for deletion.
   * @returns Nothing.
   */
  const requestDelete = (id: number) => {
    if (pendingDeleteId === id) {
      onDelete(id);
      setPendingDeleteId(null);
    } else {
      setPendingDeleteId(id);
    }
  };

  useEffect(() => {
    if (!isOpen || viewMode !== "list") return;

    /**
     * Capture-phase list-mode key handler: j/k move the selection, a starts a
     * new note, Enter opens the selected note for editing, x arms/confirms
     * delete, and Escape closes the panel. Handled keys are always swallowed
     * (preventDefault + stopPropagation), even with an empty list, so they
     * never leak to the global command hook while the panel is open.
     * @param event - The native keydown event dispatched on window.
     * @returns Nothing.
     */
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (["j", "k", "a", "Enter", "x"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();

        if (event.key === "a") {
          startEdit(null, "");
          return;
        }

        const currentNotes = notesRef.current;
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
            startEdit(target.id, target.body);
          }
        } else if (event.key === "x") {
          const target = currentNotes[selectedIndexRef.current];
          if (target) {
            requestDelete(target.id);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, viewMode, onClose, onDelete, pendingDeleteId]);

  /**
   * Edit-view key handler for the draft textarea: Enter (without Shift) trims
   * and submits the draft via `onAdd`/`onEdit` depending on whether an
   * existing note is being edited, then returns to the list; Shift+Enter is
   * left alone so the textarea inserts a newline; Escape discards the draft
   * and returns to the list without saving.
   * @param event - The React keydown event from the textarea.
   * @returns Nothing.
   */
  const handleTextareaKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const trimmed = draft.trim();
      if (!trimmed) {
        return;
      }
      if (editingId === null) {
        onAdd(trimmed);
      } else {
        onEdit(editingId, trimmed);
      }
      setViewMode("list");
    } else if (event.key === "Escape") {
      event.preventDefault();
      setViewMode("list");
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {viewMode === "edit" ? (
          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            aria-label={editingId === null ? "New note" : "Edit note"}
            placeholder="Enter to save, Shift+Enter for a new line, Esc to cancel"
          />
        ) : notes.length === 0 ? (
          <p className={styles.empty}>No notes yet. Press &quot;a&quot; to add one.</p>
        ) : (
          <ul className={styles.list}>
            {notes.map((note, index) => (
              <li
                key={note.id}
                className={`${styles.row} ${index === selectedIndex ? styles.selected : ""}`}
              >
                <button
                  type="button"
                  className={styles.rowBody}
                  onClick={() => startEdit(note.id, note.body)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className={styles.snippet}>{note.body}</span>
                </button>
                <button
                  type="button"
                  className={`${styles.delete} ${pendingDeleteId === note.id ? styles.deleteArmed : ""}`}
                  aria-label={pendingDeleteId === note.id ? "Confirm delete note" : "Delete note"}
                  onClick={() => requestDelete(note.id)}
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
