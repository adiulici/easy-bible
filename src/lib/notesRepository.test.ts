import { describe, it, expect, vi, beforeEach } from "vitest";

const fromMock = vi.fn();
vi.mock("./supabase", () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

import { listNotes, createNote, updateNoteBody, deleteNote } from "./notesRepository";

describe("listNotes", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("maps rows to camelCase Notes, ordered oldest-first", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 1,
          book: "Geneza",
          chapter: 1,
          verse: "1",
          body: "hi",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: null,
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    const result = await listNotes();

    expect(fromMock).toHaveBeenCalledWith("notes");
    expect(select).toHaveBeenCalledWith("*");
    expect(order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result).toEqual([
      {
        id: 1,
        book: "Geneza",
        chapter: 1,
        verse: "1",
        body: "hi",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: null,
      },
    ]);
  });

  it("throws when Supabase returns an error", async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const select = vi.fn().mockReturnValue({ order });
    fromMock.mockReturnValue({ select });

    await expect(listNotes()).rejects.toThrow("boom");
  });
});

describe("createNote", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("inserts and returns the mapped created note", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 5,
        book: "Ioan",
        chapter: 3,
        verse: "16",
        body: "note body",
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: null,
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    fromMock.mockReturnValue({ insert });

    const result = await createNote({ book: "Ioan", chapter: 3, verse: "16", body: "note body" });

    expect(insert).toHaveBeenCalledWith({ book: "Ioan", chapter: 3, verse: "16", body: "note body" });
    expect(result.id).toBe(5);
    expect(result.createdAt).toBe("2026-01-02T00:00:00.000Z");
  });
});

describe("updateNoteBody", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("updates the body and stamps updated_at", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 5,
        book: "Ioan",
        chapter: 3,
        verse: "16",
        body: "edited",
        created_at: "2026-01-02T00:00:00.000Z",
        updated_at: "2026-01-03T00:00:00.000Z",
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ update });

    const result = await updateNoteBody(5, "edited");

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ body: "edited" }));
    expect(eq).toHaveBeenCalledWith("id", 5);
    expect(result.updatedAt).toBe("2026-01-03T00:00:00.000Z");
  });
});

describe("deleteNote", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("deletes by id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ delete: del });

    await deleteNote(5);

    expect(del).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("id", 5);
  });

  it("throws when Supabase returns an error", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "nope" } });
    const del = vi.fn().mockReturnValue({ eq });
    fromMock.mockReturnValue({ delete: del });

    await expect(deleteNote(5)).rejects.toThrow("nope");
  });
});
