import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import NotesPanel from "@/components/NotesPanel";
import type { Note } from "@/types/notes";

const notes: Note[] = [
  { id: 1, book: "Geneza", chapter: 1, verse: "1", body: "First thought", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: null },
  { id: 2, book: "Geneza", chapter: 1, verse: "1", body: "Second thought", createdAt: "2026-01-02T00:00:00.000Z", updatedAt: null },
];

function pressKey(key: string, options: Partial<KeyboardEventInit> = {}) {
  fireEvent.keyDown(window, { key, ...options });
}

describe("NotesPanel", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <NotesPanel isOpen={false} notes={notes} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the empty state when there are no notes", () => {
    render(
      <NotesPanel isOpen notes={[]} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
  });

  it("lists notes oldest-first", () => {
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("First thought");
    expect(items[1]).toHaveTextContent("Second thought");
  });

  it("preselects the note matching focusNoteId", () => {
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={2} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    const items = screen.getAllByRole("listitem");
    expect(items[1].className).toMatch(/selected/);
  });

  it("'a' opens a blank edit box for a new note", () => {
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    pressKey("a");
    expect(screen.getByLabelText("New note")).toHaveValue("");
  });

  it("Enter opens the selected note for editing with its body preloaded", () => {
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    pressKey("Enter");
    expect(screen.getByLabelText("Edit note")).toHaveValue("First thought");
  });

  it("Enter (no shift) in the textarea submits a new note and returns to the list", () => {
    const onAdd = vi.fn();
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={onAdd} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    pressKey("a");
    const textarea = screen.getByLabelText("New note");
    fireEvent.change(textarea, { target: { value: "Brand new note" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onAdd).toHaveBeenCalledWith("Brand new note");
    expect(screen.queryByLabelText("New note")).not.toBeInTheDocument();
  });

  it("Shift+Enter in the textarea does not submit", () => {
    const onAdd = vi.fn();
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={onAdd} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    pressKey("a");
    const textarea = screen.getByLabelText("New note");
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("Escape in the textarea cancels back to the list without saving", () => {
    const onAdd = vi.fn();
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={onAdd} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    pressKey("a");
    const textarea = screen.getByLabelText("New note");
    fireEvent.keyDown(textarea, { key: "Escape" });
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("x arms delete on first press and confirms on second", () => {
    const onDelete = vi.fn();
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />
    );
    pressKey("x");
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Confirm delete note")).toBeInTheDocument();
    pressKey("x");
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it("moving the selection disarms a pending delete", () => {
    const onDelete = vi.fn();
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />
    );
    pressKey("x");
    pressKey("j");
    pressKey("x");
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("Enter (no shift) in the textarea submits an edit to an existing note", () => {
    const onEdit = vi.fn();
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    pressKey("Enter");
    const textarea = screen.getByLabelText("Edit note");
    fireEvent.change(textarea, { target: { value: "Updated thought" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onEdit).toHaveBeenCalledWith(1, "Updated thought");
    expect(screen.queryByLabelText("Edit note")).not.toBeInTheDocument();
  });

  it("preselects the target note once it arrives in notes after a cross-book jump", () => {
    const { rerender } = render(
      <NotesPanel isOpen notes={[]} focusNoteId={2} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    // Target book's content hasn't loaded yet: no notes, no crash, defaults to index 0.
    expect(screen.getByText(/No notes yet/)).toBeInTheDocument();

    // Content finishes loading: the same instance re-renders with the real notes list.
    rerender(
      <NotesPanel isOpen notes={notes} focusNoteId={2} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    const items = screen.getAllByRole("listitem");
    expect(items[1].className).toMatch(/selected/);
  });

  it("does not reset selection when notes changes while focusNoteId is null", () => {
    const { rerender } = render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    pressKey("j");
    let items = screen.getAllByRole("listitem");
    expect(items[1].className).toMatch(/selected/);

    const withNewNote: Note[] = [
      ...notes,
      { id: 3, book: "Geneza", chapter: 1, verse: "1", body: "Third thought", createdAt: "2026-01-03T00:00:00.000Z", updatedAt: null },
    ];
    rerender(
      <NotesPanel isOpen notes={withNewNote} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    items = screen.getAllByRole("listitem");
    expect(items[1].className).toMatch(/selected/);
  });

  it("Escape in list mode closes the panel", () => {
    const onClose = vi.fn();
    render(
      <NotesPanel isOpen notes={notes} focusNoteId={null} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onClose={onClose} />
    );
    pressKey("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
