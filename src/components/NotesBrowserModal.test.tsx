import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import NotesBrowserModal from "@/components/NotesBrowserModal";
import type { Note } from "@/types/notes";

const notes: Note[] = [
  { id: 1, book: "Geneza", chapter: 1, verse: "1", body: "Note in Geneza", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: null },
  { id: 2, book: "Ioan", chapter: 3, verse: "16", body: "Note in Ioan", createdAt: "2026-01-02T00:00:00.000Z", updatedAt: null },
];

function pressKey(key: string) {
  fireEvent.keyDown(window, { key });
}

describe("NotesBrowserModal", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <NotesBrowserModal isOpen={false} notes={notes} currentBook="Geneza" onJump={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to the current book's scope", () => {
    render(
      <NotesBrowserModal isOpen notes={notes} currentBook="Geneza" onJump={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText("Notes in Geneza")).toBeInTheDocument();
    expect(screen.getByText("Press f for all books")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Note in Geneza");
  });

  it("'f' toggles to all notes across every book", () => {
    render(
      <NotesBrowserModal isOpen notes={notes} currentBook="Geneza" onJump={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    pressKey("f");
    expect(screen.getByText("All notes")).toBeInTheDocument();
    expect(screen.getByText("Press f for current book")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("Enter jumps to the selected note and closes", () => {
    const onJump = vi.fn();
    const onClose = vi.fn();
    render(
      <NotesBrowserModal isOpen notes={notes} currentBook="Geneza" onJump={onJump} onDelete={vi.fn()} onClose={onClose} />
    );
    pressKey("Enter");
    expect(onJump).toHaveBeenCalledWith(notes[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("x arms delete on first press and confirms on second", () => {
    const onDelete = vi.fn();
    render(
      <NotesBrowserModal isOpen notes={notes} currentBook="Geneza" onJump={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />
    );
    pressKey("x");
    expect(onDelete).not.toHaveBeenCalled();
    pressKey("x");
    expect(onDelete).toHaveBeenCalledWith(notes[0]);
  });

  it("Escape closes the modal", () => {
    const onClose = vi.fn();
    render(
      <NotesBrowserModal isOpen notes={notes} currentBook="Geneza" onJump={vi.fn()} onDelete={vi.fn()} onClose={onClose} />
    );
    pressKey("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
