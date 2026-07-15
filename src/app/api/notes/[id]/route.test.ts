import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const updateNoteBodyMock = vi.fn();
const deleteNoteMock = vi.fn();
vi.mock("@/lib/notesRepository", () => ({
  updateNoteBody: (...args: unknown[]) => updateNoteBodyMock(...args),
  deleteNote: (...args: unknown[]) => deleteNoteMock(...args),
}));

import { PATCH, DELETE } from "./route";

describe("PATCH /api/notes/[id]", () => {
  beforeEach(() => {
    updateNoteBodyMock.mockReset();
  });

  it("updates the note body and returns it", async () => {
    updateNoteBodyMock.mockResolvedValue({
      id: 5,
      book: "Geneza",
      chapter: 1,
      verse: "1",
      body: "edited",
      createdAt: "x",
      updatedAt: "y",
    });
    const request = new NextRequest("http://localhost/api/notes/5", {
      method: "PATCH",
      body: JSON.stringify({ body: "edited" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "5" }) });
    expect(response.status).toBe(200);
    expect(updateNoteBodyMock).toHaveBeenCalledWith(5, "edited");
  });

  it("returns 400 for a non-numeric id", async () => {
    const request = new NextRequest("http://localhost/api/notes/abc", {
      method: "PATCH",
      body: JSON.stringify({ body: "edited" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "abc" }) });
    expect(response.status).toBe(400);
  });

  it("returns 400 when body is missing", async () => {
    const request = new NextRequest("http://localhost/api/notes/5", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "5" }) });
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed JSON body", async () => {
    const request = new NextRequest("http://localhost/api/notes/5", {
      method: "PATCH",
      body: "not json",
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "5" }) });
    expect(response.status).toBe(400);
  });

  it("returns 500 when the repository throws", async () => {
    updateNoteBodyMock.mockRejectedValue(new Error("boom"));
    const request = new NextRequest("http://localhost/api/notes/5", {
      method: "PATCH",
      body: JSON.stringify({ body: "edited" }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: "5" }) });
    expect(response.status).toBe(500);
  });
});

describe("DELETE /api/notes/[id]", () => {
  beforeEach(() => {
    deleteNoteMock.mockReset();
  });

  it("deletes and returns 204", async () => {
    deleteNoteMock.mockResolvedValue(undefined);
    const request = new NextRequest("http://localhost/api/notes/5", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "5" }) });
    expect(response.status).toBe(204);
  });

  it("returns 400 for a non-numeric id", async () => {
    const request = new NextRequest("http://localhost/api/notes/abc", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "abc" }) });
    expect(response.status).toBe(400);
  });

  it("returns 500 when the repository throws", async () => {
    deleteNoteMock.mockRejectedValue(new Error("boom"));
    const request = new NextRequest("http://localhost/api/notes/5", { method: "DELETE" });
    const response = await DELETE(request, { params: Promise.resolve({ id: "5" }) });
    expect(response.status).toBe(500);
  });
});
