import { supabase } from "./supabase";
import type { Note } from "@/types/notes";

interface NoteRow {
  id: number;
  book: string;
  chapter: number;
  verse: string;
  body: string;
  created_at: string;
  updated_at: string | null;
}

/**
 * Maps a raw Supabase `notes` row (snake_case) to the app's Note shape (camelCase).
 * @param row - Raw row as returned by the Supabase client.
 * @returns The mapped Note.
 */
function mapRow(row: NoteRow): Note {
  return {
    id: row.id,
    book: row.book,
    chapter: row.chapter,
    verse: row.verse,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lists every note, oldest-first (matches the UI's per-verse ordering).
 * @returns All notes across every book/chapter/verse.
 */
export async function listNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    throw new Error(error.message);
  }
  return (data as NoteRow[]).map(mapRow);
}

/**
 * Creates a note on a verse.
 * @param input - Verse identity (book/chapter/verse) and body text.
 * @returns The created note, with its server-assigned id and createdAt.
 */
export async function createNote(input: {
  book: string;
  chapter: number;
  verse: string;
  body: string;
}): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .insert({ book: input.book, chapter: input.chapter, verse: input.verse, body: input.body })
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return mapRow(data as NoteRow);
}

/**
 * Updates a note's body, stamping updatedAt to now.
 * @param id - Id of the note to update.
 * @param body - New body text.
 * @returns The updated note.
 */
export async function updateNoteBody(id: number, body: string): Promise<Note> {
  const { data, error } = await supabase
    .from("notes")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    throw new Error(error.message);
  }
  return mapRow(data as NoteRow);
}

/**
 * Deletes a note.
 * @param id - Id of the note to delete.
 * @returns void
 */
export async function deleteNote(id: number): Promise<void> {
  const { error } = await supabase.from("notes").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}
