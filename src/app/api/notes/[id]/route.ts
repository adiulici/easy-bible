import { NextResponse, NextRequest } from "next/server";
import { updateNoteBody, deleteNote } from "@/lib/notesRepository";

/**
 * Parses the `[id]` route param into a positive integer.
 * @param raw - Raw route param string.
 * @returns The parsed id, or null if invalid.
 */
function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

/**
 * Handles PATCH /api/notes/[id], updating a note's body.
 * @param request - Expects a JSON body: {body}.
 * @param context - Route context carrying the `[id]` param.
 * @returns JSON response with the updated note, or a 400/500 error.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse request body:", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const body = payload?.body;
  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "Missing body" }, { status: 400 });
  }

  try {
    const note = await updateNoteBody(id, body);
    return NextResponse.json(note);
  } catch (error) {
    console.error("Failed to update note:", error);
    return NextResponse.json({ error: "Failed to update note" }, { status: 500 });
  }
}

/**
 * Handles DELETE /api/notes/[id], removing a note.
 * @param request - Unused; DELETE carries no body.
 * @param context - Route context carrying the `[id]` param.
 * @returns 204 on success, or a 400/500 error.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: rawId } = await context.params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    await deleteNote(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return NextResponse.json({ error: "Failed to delete note" }, { status: 500 });
  }
}
