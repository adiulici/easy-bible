"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "@/types/notes";
import { replaceNoteId, applyNoteEdit, removeNoteById } from "@/utils/notes";

export interface UseNotesAPI {
  notes: Note[];
  addNote: (book: string, chapter: number, verse: string, body: string) => void;
  editNote: (id: number, body: string) => void;
  deleteNote: (id: number) => void;
}

/**
 * Loads every note once on mount and caches it in memory; add/edit/delete apply
 * optimistically (instant local update, background request, rollback + onError
 * on failure). Optimistic notes are assigned a negative id (`-Date.now()`) so
 * they can never collide with a real Postgres bigint id, which is always
 * positive - `replaceNoteId` swaps it out once the server confirms the real id.
 * @param onError - Called with a user-facing message when a request fails.
 * @returns The in-memory notes list and add/edit/delete mutators.
 */
export function useNotes(onError: (message: string) => void): UseNotesAPI {
  const [notes, setNotes] = useState<Note[]>([]);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    let isStale = false;
    fetch("/api/notes")
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (isStale) return;
        setNotes(data);
      })
      .catch((error) => {
        if (!isStale) {
          console.error("Failed to load notes:", error);
          onErrorRef.current("Could not load notes");
        }
      });
    return () => {
      isStale = true;
    };
  }, []);

  /**
   * Adds a note optimistically: an in-memory note with a negative temp id is
   * inserted immediately, then a background POST persists it. On success the
   * temp id is swapped for the server-confirmed note (via `replaceNoteId`); on
   * failure the optimistic note is removed (via `removeNoteById`) and `onError`
   * is called.
   * @param book - Book name the note is attached to.
   * @param chapter - Chapter number the note is attached to.
   * @param verse - Verse number key the note is attached to.
   * @param body - Note text.
   * @returns Nothing; state is updated in place.
   */
  const addNote = useCallback((book: string, chapter: number, verse: string, body: string) => {
    const tempId = -Date.now();
    const optimistic: Note = {
      id: tempId,
      book,
      chapter,
      verse,
      body,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    };
    setNotes((prev) => [...prev, optimistic]);

    fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, chapter, verse, body }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
      })
      .then((confirmed: Note) => {
        setNotes((prev) => replaceNoteId(prev, tempId, confirmed));
      })
      .catch((error) => {
        console.error("Failed to add note:", error);
        setNotes((prev) => removeNoteById(prev, tempId));
        onErrorRef.current("Could not save note");
      });
  }, []);

  /**
   * Edits a note's body optimistically: the local note is updated immediately
   * (via `applyNoteEdit`), then a background PATCH persists it. On failure the
   * list is rolled back to its pre-edit snapshot and `onError` is called.
   * @param id - Id of the note to edit.
   * @param body - New note text.
   * @returns Nothing; state is updated in place.
   */
  const editNote = useCallback((id: number, body: string) => {
    let previous: Note[] = [];
    const updatedAt = new Date().toISOString();
    setNotes((prev) => {
      previous = prev;
      return applyNoteEdit(prev, id, body, updatedAt);
    });

    fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      })
      .catch((error) => {
        console.error("Failed to edit note:", error);
        setNotes(previous);
        onErrorRef.current("Could not save note");
      });
  }, []);

  /**
   * Deletes a note optimistically: the local note is removed immediately (via
   * `removeNoteById`), then a background DELETE persists it. On failure the
   * list is rolled back to its pre-delete snapshot and `onError` is called.
   * @param id - Id of the note to delete.
   * @returns Nothing; state is updated in place.
   */
  const deleteNote = useCallback((id: number) => {
    let previous: Note[] = [];
    setNotes((prev) => {
      previous = prev;
      return removeNoteById(prev, id);
    });

    fetch(`/api/notes/${id}`, { method: "DELETE" })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      })
      .catch((error) => {
        console.error("Failed to delete note:", error);
        setNotes(previous);
        onErrorRef.current("Could not delete note");
      });
  }, []);

  return { notes, addNote, editNote, deleteNote };
}
