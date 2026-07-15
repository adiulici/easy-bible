import { NextResponse, NextRequest } from "next/server";
import { listNotes, createNote } from "@/lib/notesRepository";

/**
 * Handles GET /api/notes, returning every note across the app (oldest-first).
 * @returns JSON response with the full notes list, or a 500 on failure.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const notes = await listNotes();
    return NextResponse.json(notes);
  } catch (error) {
    console.error("Failed to list notes:", error);
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 });
  }
}

/**
 * Handles POST /api/notes, creating a note on a verse.
 * @param request - Expects a JSON body: {book, chapter, verse, body}.
 * @returns JSON response with the created note, or a 400/500 error.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse request body:", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { book, chapter, verse, body } = payload ?? {};

  if (typeof book !== "string" || !book) {
    return NextResponse.json({ error: "Missing book" }, { status: 400 });
  }
  if (typeof chapter !== "number") {
    return NextResponse.json({ error: "Missing chapter" }, { status: 400 });
  }
  if (typeof verse !== "string" || !verse) {
    return NextResponse.json({ error: "Missing verse" }, { status: 400 });
  }
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }

  try {
    const note = await createNote({ book, chapter, verse, body });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("Failed to create note:", error);
    return NextResponse.json({ error: "Failed to create note" }, { status: 500 });
  }
}
