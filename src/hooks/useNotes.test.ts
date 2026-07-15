import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useNotes } from "@/hooks/useNotes";

describe("useNotes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("loads notes on mount", async () => {
    const loaded = [
      { id: 1, book: "Geneza", chapter: 1, verse: "1", body: "hi", createdAt: "x", updatedAt: null },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(loaded) }));

    const onError = vi.fn();
    const { result } = renderHook(() => useNotes(onError));

    await waitFor(() => expect(result.current.notes).toEqual(loaded));
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onError when the initial load fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const onError = vi.fn();
    renderHook(() => useNotes(onError));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Could not load notes"));
  });

  it("calls onError and keeps notes as [] when the initial load returns a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({ error: "Failed to load notes" }) })
    );
    const onError = vi.fn();
    const { result } = renderHook(() => useNotes(onError));

    await waitFor(() => expect(onError).toHaveBeenCalledWith("Could not load notes"));
    expect(result.current.notes).toEqual([]);
  });

  it("addNote applies optimistically, then swaps in the server id on success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ id: 99, book: "Geneza", chapter: 1, verse: "1", body: "new note", createdAt: "x", updatedAt: null }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useNotes(vi.fn()));
    await waitFor(() => expect(result.current.notes).toEqual([]));

    act(() => {
      result.current.addNote("Geneza", 1, "1", "new note");
    });
    expect(result.current.notes).toHaveLength(1);
    expect(result.current.notes[0].id).toBeLessThan(0);

    await waitFor(() => expect(result.current.notes[0].id).toBe(99));
  });

  it("addNote rolls back and calls onError when the request fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
      .mockRejectedValueOnce(new Error("save failed"));
    vi.stubGlobal("fetch", fetchMock);

    const onError = vi.fn();
    const { result } = renderHook(() => useNotes(onError));
    await waitFor(() => expect(result.current.notes).toEqual([]));

    act(() => {
      result.current.addNote("Geneza", 1, "1", "new note");
    });
    expect(result.current.notes).toHaveLength(1);

    await waitFor(() => expect(result.current.notes).toHaveLength(0));
    expect(onError).toHaveBeenCalledWith("Could not save note");
  });

  it("editNote applies optimistically and keeps the change when the request succeeds", async () => {
    const existing = [
      { id: 1, book: "Geneza", chapter: 1, verse: "1", body: "hi", createdAt: "x", updatedAt: null },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(existing) })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const onError = vi.fn();
    const { result } = renderHook(() => useNotes(onError));
    await waitFor(() => expect(result.current.notes).toEqual(existing));

    act(() => {
      result.current.editNote(1, "edited body");
    });
    expect(result.current.notes[0].body).toBe("edited body");
    expect(result.current.notes[0].updatedAt).not.toBeNull();

    await waitFor(() => expect(result.current.notes[0].body).toBe("edited body"));
    expect(result.current.notes[0].updatedAt).not.toBeNull();
    expect(onError).not.toHaveBeenCalled();
  });

  it("editNote rolls back and calls onError when the request fails", async () => {
    const existing = [
      { id: 1, book: "Geneza", chapter: 1, verse: "1", body: "hi", createdAt: "x", updatedAt: null },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(existing) })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const onError = vi.fn();
    const { result } = renderHook(() => useNotes(onError));
    await waitFor(() => expect(result.current.notes).toEqual(existing));

    act(() => {
      result.current.editNote(1, "edited body");
    });
    expect(result.current.notes[0].body).toBe("edited body");

    await waitFor(() => expect(result.current.notes).toEqual(existing));
    expect(onError).toHaveBeenCalledWith("Could not save note");
  });

  it("deleteNote rolls back and calls onError when the request fails", async () => {
    const existing = [
      { id: 1, book: "Geneza", chapter: 1, verse: "1", body: "hi", createdAt: "x", updatedAt: null },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(existing) })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    const onError = vi.fn();
    const { result } = renderHook(() => useNotes(onError));
    await waitFor(() => expect(result.current.notes).toEqual(existing));

    act(() => {
      result.current.deleteNote(1);
    });
    expect(result.current.notes).toHaveLength(0);

    await waitFor(() => expect(result.current.notes).toEqual(existing));
    expect(onError).toHaveBeenCalledWith("Could not delete note");
  });
});
