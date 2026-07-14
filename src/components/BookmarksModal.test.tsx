import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import BookmarksModal from "@/components/BookmarksModal";
import type { Bookmark } from "@/utils/bookmarks";

const bookmarks: Bookmark[] = [
  { book: "Ioan", chapter: 3, verse: "16", text: "Fiindcă atât de mult...", createdAt: 3000 },
  { book: "Geneza", chapter: 1, verse: "1", text: "La început...", createdAt: 1000 },
];

/**
 * Dispatches a capture-phase keydown on window (the modal listens in capture).
 * @param key - The KeyboardEvent.key value to fire.
 * @returns void
 */
function pressKey(key: string) {
  fireEvent.keyDown(window, { key });
}

describe("BookmarksModal", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <BookmarksModal isOpen={false} bookmarks={bookmarks} onJump={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders rows in the given (newest-first) order with reference + snippet", () => {
    render(
      <BookmarksModal isOpen bookmarks={bookmarks} onJump={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Ioan 3:16");
    expect(items[0]).toHaveTextContent("Fiindcă atât de mult...");
    expect(items[1]).toHaveTextContent("Geneza 1:1");
  });

  it("shows the empty state when there are no bookmarks", () => {
    render(
      <BookmarksModal isOpen bookmarks={[]} onJump={vi.fn()} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText("No bookmarks yet.")).toBeInTheDocument();
  });

  it("Enter jumps to the selected bookmark and closes", () => {
    const onJump = vi.fn();
    const onClose = vi.fn();
    render(
      <BookmarksModal isOpen bookmarks={bookmarks} onJump={onJump} onDelete={vi.fn()} onClose={onClose} />
    );
    pressKey("Enter");
    expect(onJump).toHaveBeenCalledWith(bookmarks[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("j/k move the selection so Enter targets a different row", () => {
    const onJump = vi.fn();
    render(
      <BookmarksModal isOpen bookmarks={bookmarks} onJump={onJump} onDelete={vi.fn()} onClose={vi.fn()} />
    );
    pressKey("j");
    pressKey("Enter");
    expect(onJump).toHaveBeenCalledWith(bookmarks[1]);
  });

  it("x deletes the selected bookmark and keeps the modal open", () => {
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <BookmarksModal isOpen bookmarks={bookmarks} onJump={vi.fn()} onDelete={onDelete} onClose={onClose} />
    );
    pressKey("x");
    expect(onDelete).toHaveBeenCalledWith(bookmarks[0]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Esc closes the modal", () => {
    const onClose = vi.fn();
    render(
      <BookmarksModal isOpen bookmarks={bookmarks} onJump={vi.fn()} onDelete={vi.fn()} onClose={onClose} />
    );
    pressKey("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking a row jumps and closes", () => {
    const onJump = vi.fn();
    const onClose = vi.fn();
    render(
      <BookmarksModal isOpen bookmarks={bookmarks} onJump={onJump} onDelete={vi.fn()} onClose={onClose} />
    );
    fireEvent.click(screen.getByText("Geneza 1:1"));
    expect(onJump).toHaveBeenCalledWith(bookmarks[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("swallows j/k/x/Enter even when the list is empty (preventDefault, no callbacks leak)", () => {
    const onJump = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(
      <BookmarksModal isOpen bookmarks={[]} onJump={onJump} onDelete={onDelete} onClose={onClose} />
    );
    for (const key of ["j", "k", "x", "Enter"]) {
      const event = new KeyboardEvent("keydown", { key, cancelable: true, bubbles: true });
      window.dispatchEvent(event);
      // Handled keys must be swallowed so they never reach the global command
      // hook, even with nothing to act on.
      expect(event.defaultPrevented).toBe(true);
    }
    expect(onJump).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clicking a per-row delete button removes that bookmark", () => {
    const onDelete = vi.fn();
    render(
      <BookmarksModal isOpen bookmarks={bookmarks} onJump={vi.fn()} onDelete={onDelete} onClose={vi.fn()} />
    );
    const deleteButtons = screen.getAllByLabelText("Delete bookmark");
    fireEvent.click(deleteButtons[1]);
    expect(onDelete).toHaveBeenCalledWith(bookmarks[1]);
  });
});
