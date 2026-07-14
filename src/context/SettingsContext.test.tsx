import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SettingsProvider, useSettings } from "@/context/SettingsContext";

/**
 * Probe consumer that surfaces the current bookmarks state and exposes a
 * toggle button, so tests can assert on context behavior via the DOM.
 * @returns JSX rendering bookmark count/JSON plus a toggle trigger.
 */
function Probe() {
  const { settings, toggleBookmark } = useSettings();
  return (
    <div>
      <span data-testid="count">{settings.bookmarks.length}</span>
      <span data-testid="json">{JSON.stringify(settings.bookmarks)}</span>
      <button
        onClick={() =>
          toggleBookmark({
            book: "Geneza",
            chapter: 1,
            verse: "1",
            text: "La început",
            createdAt: 123,
          })
        }
      >
        toggle
      </button>
    </div>
  );
}

const STORAGE_KEY = "biblia-settings";

describe("SettingsContext bookmarks", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults bookmarks to [] when an old blob lacks the field", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ currentBook: "Exodul", currentChapter: 2 })
    );
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );
    expect(screen.getByTestId("count").textContent).toBe("0");
    expect(screen.getByTestId("json").textContent).toBe("[]");
  });

  it("persists a toggled bookmark to localStorage", () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>
    );
    act(() => {
      screen.getByText("toggle").click();
    });
    expect(screen.getByTestId("count").textContent).toBe("1");
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    expect(stored.bookmarks).toHaveLength(1);
    expect(stored.bookmarks[0].verse).toBe("1");
  });
});
