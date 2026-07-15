import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const listNotesMock = vi.fn();
const createNoteMock = vi.fn();
vi.mock("@/lib/notesRepository", () => ({
  listNotes: (...args: unknown[]) => listNotesMock(...args),
  createNote: (...args: unknown[]) => createNoteMock(...args),
}));

import { GET, POST } from "./route";

describe("GET /api/notes", () => {
  beforeEach(() => {
    listNotesMock.mockReset();
  });

  it("returns the notes list as JSON", async () => {
    listNotesMock.mockResolvedValue([
      { id: 1, book: "Geneza", chapter: 1, verse: "1", body: "hi", createdAt: "x", updatedAt: null },
    ]);
    const response = await GET();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data).toHaveLength(1);
  });

  it("returns 500 when the repository throws", async () => {
    listNotesMock.mockRejectedValue(new Error("boom"));
    const response = await GET();
    expect(response.status).toBe(500);
  });
});

describe("POST /api/notes", () => {
  beforeEach(() => {
    createNoteMock.mockReset();
  });

  it("creates a note and returns it with status 201", async () => {
    createNoteMock.mockResolvedValue({
      id: 1,
      book: "Geneza",
      chapter: 1,
      verse: "1",
      body: "hi",
      createdAt: "x",
      updatedAt: null,
    });
    const request = new NextRequest("http://localhost/api/notes", {
      method: "POST",
      body: JSON.stringify({ book: "Geneza", chapter: 1, verse: "1", body: "hi" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(createNoteMock).toHaveBeenCalledWith({ book: "Geneza", chapter: 1, verse: "1", body: "hi" });
  });

  it("returns 400 when the body is missing", async () => {
    const request = new NextRequest("http://localhost/api/notes", {
      method: "POST",
      body: JSON.stringify({ book: "Geneza", chapter: 1, verse: "1" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when book is missing", async () => {
    const request = new NextRequest("http://localhost/api/notes", {
      method: "POST",
      body: JSON.stringify({ chapter: 1, verse: "1", body: "hi" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when chapter is missing or the wrong type", async () => {
    const request = new NextRequest("http://localhost/api/notes", {
      method: "POST",
      body: JSON.stringify({ book: "Geneza", chapter: "1", verse: "1", body: "hi" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 when verse is missing", async () => {
    const request = new NextRequest("http://localhost/api/notes", {
      method: "POST",
      body: JSON.stringify({ book: "Geneza", chapter: 1, body: "hi" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body", async () => {
    const request = new NextRequest("http://localhost/api/notes", {
      method: "POST",
      body: "not json",
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
