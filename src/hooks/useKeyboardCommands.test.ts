import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboardCommands } from "@/hooks/useKeyboardCommands";

/**
 * Dispatches a bubble-phase keydown on window (the global command hook listens
 * on window without capture).
 * @param key - The KeyboardEvent.key value to fire.
 * @returns void
 */
function pressKey(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

describe("useKeyboardCommands", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("fires a single command's handler on its key", () => {
    const handler = vi.fn();
    const { result } = renderHook(() => useKeyboardCommands());
    act(() => {
      result.current.registerCommand({ key: "a", type: "single", handler });
    });
    act(() => {
      pressKey("a");
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("activates a modal command's mode", () => {
    const { result } = renderHook(() => useKeyboardCommands());
    act(() => {
      result.current.registerCommand({ key: "A", type: "modal", mode: "notes-browser" });
    });
    act(() => {
      pressKey("A");
    });
    expect(result.current.activeMode).toBe("notes-browser");
  });

  it("setActiveMode lets a caller switch mode programmatically", () => {
    const { result } = renderHook(() => useKeyboardCommands());
    act(() => {
      result.current.setActiveMode("notes");
    });
    expect(result.current.activeMode).toBe("notes");
  });

  it("cancelCommand resets a mode set via setActiveMode", () => {
    const { result } = renderHook(() => useKeyboardCommands());
    act(() => {
      result.current.setActiveMode("notes");
    });
    act(() => {
      result.current.cancelCommand();
    });
    expect(result.current.activeMode).toBeNull();
  });
});
