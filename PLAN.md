# Biblia App - Implementation Plan

A minimalistic Bible app with vim-inspired keyboard navigation.

## Overview

- **Translation**: Romanian (Cornilescu)
- **Design**: Minimalistic, clean typography, generous line heights
- **Navigation**: Keyboard-first, vim-inspired
- **Persistence**: Settings stored in localStorage

---

## Task 1: Create the Keyboard Command System - ✅ DONE

**Goal**: Build a robust, extensible system for handling keyboard commands.

**Details**:
- Create a `useKeyboardCommands` hook in `src/hooks/useKeyboardCommands.ts`
- The hook should support:
  - Single key commands (e.g., `v` for visibility modal)
  - Commands that open modals and wait for input (e.g., `g` for go to chapter)
  - Navigation keys (`j`, `k`, `h`, `l`)
- The hook should expose:
  - Current active command/mode (e.g., `null`, `"goto-chapter"`, `"goto-book"`, `"visibility"`)
  - Input buffer for commands that accept input (e.g., the chapter number being typed)
  - Functions to register/unregister commands
- Commands should be ignored when the user is typing in an actual input field
- The system should be easy to extend with new commands

**File structure**:
```
src/
  hooks/
    useKeyboardCommands.ts
  types/
    commands.ts  (type definitions for commands)
```

**Acceptance criteria**:
- [x] Hook correctly captures keyboard events
- [x] Single-key commands trigger immediately
- [x] Modal commands set the active mode and collect input
- [x] Escape key cancels any active command/modal
- [x] Commands are ignored when focus is in an input element

---

## Task 2: Create the Command Modal Component - ✅ DONE

**Goal**: Build a reusable modal component for keyboard commands.

**Details**:
- Create `src/components/CommandModal.tsx`
- The modal should:
  - Appear centered on screen with a semi-transparent white/light background
  - Have a clean, minimal design (no borders, subtle shadow)
  - Display a prompt text (e.g., "Go to chapter:")
  - Display the current input value next to the prompt
  - Use an actual `<input>` element (hidden/styled) to capture input and allow backspace/arrow keys
  - Close when Escape is pressed or action is completed
- Props:
  - `isOpen: boolean`
  - `prompt: string` (e.g., "Go to chapter:")
  - `value: string` (current input value)
  - `onChange: (value: string) => void`
  - `onSubmit: () => void`
  - `onCancel: () => void`
- Keep styling minimal and elegant

**File structure**:
```
src/
  components/
    CommandModal.tsx
    CommandModal.module.css
```

**Acceptance criteria**:
- [x] Modal renders centered with semi-transparent background
- [x] Input is captured correctly (including backspace, arrows)
- [x] Enter submits, Escape cancels
- [x] Smooth fade-in animation (optional but nice)

---

## Task 3: Create the Visibility Settings Modal - ✅ DONE

**Goal**: Build the visibility toggle modal with checkbox-style options.

**Details**:
- Create `src/components/VisibilityModal.tsx`
- Triggered by pressing `v`
- Displays a list of toggle options:
  - `[x] Chapter numbers` - shortcut `c` (enabled by default)
  - `[ ] Verse numbers` - shortcut `v` (disabled by default)
  - `[ ] Line highlighter` - shortcut `l` (disabled by default)
- Each option shows:
  - A box with `[x]` if enabled or `[ ]` if disabled
  - The option name
  - The shortcut key in parentheses or subtle styling
- Pressing the shortcut key toggles that option immediately
- Pressing Escape or clicking outside closes the modal
- The modal should have the same styling as CommandModal (centered, semi-transparent background)

**File structure**:
```
src/
  components/
    VisibilityModal.tsx
    VisibilityModal.module.css
```

**Acceptance criteria**:
- [x] Modal shows all visibility options with current state
- [x] Pressing shortcut key toggles option
- [x] Visual feedback when toggling (checkbox updates)
- [x] Escape closes the modal

---

## Task 4: Create Settings State Management with localStorage Persistence - ✅ DONE

**Goal**: Manage visibility settings with React Context and persist to localStorage.

**Details**:
- Create `src/context/SettingsContext.tsx`
- Settings to manage:
  - `showChapterNumbers: boolean` (default: `true`)
  - `showVerseNumbers: boolean` (default: `false`)
  - `showLineHighlighter: boolean` (default: `false`)
  - `currentBook: string` (default: `"Geneza"`)
  - `currentChapter: number` (default: `1`)
- Provide a `SettingsProvider` component to wrap the app
- Load settings from localStorage on mount
- Save settings to localStorage on every change
- Expose `toggleSetting(key)` and `setSetting(key, value)` functions

**File structure**:
```
src/
  context/
    SettingsContext.tsx
```

**Acceptance criteria**:
- [x] Settings load from localStorage on app start
- [x] Settings persist to localStorage on change
- [x] Default values used when no localStorage data exists
- [x] Context provides current settings and toggle/set functions

---

## Task 5: Restructure Verse Rendering for Verse Numbers - ✅ DONE

**Goal**: Update the Bible content rendering to support optional verse numbers.

**Details**:
- Modify `src/app/page.tsx` (or extract to `src/components/BibleContent.tsx`)
- Each verse should be rendered as a `<span>` with:
  - Optional superscript verse number (e.g., `<sup>1</sup>`)
  - The verse text
- Verse numbers use superscript styling (small, raised)
- Visibility controlled by `showVerseNumbers` from settings context
- Keep the flowing paragraph layout (verses inline, not on separate lines)
- Chapter numbers remain as they are (large watermark style), controlled by `showChapterNumbers`

**Styling for verse numbers**:
```css
.verseNumber {
  font-size: 0.65em;
  vertical-align: super;
  color: #999;
  margin-right: 2px;
}
```

**Acceptance criteria**:
- [x] Verse numbers appear as superscript before each verse
- [x] Verse numbers visibility controlled by settings
- [x] Chapter numbers visibility controlled by settings
- [x] Text remains readable and well-formatted

---

## Task 6: Implement "Go to Chapter" Command (g) - ✅ DONE

**Goal**: Allow user to jump to a specific chapter using the `g` key.

**Details**:
- Pressing `g` opens the CommandModal with prompt "Go to chapter:"
- User types chapter number
- Pressing Enter:
  - Validates the chapter number exists in current book
  - Scrolls smoothly to that chapter
  - Closes the modal
  - If invalid, show brief error or just close
- Pressing Escape cancels

**Integration**:
- Register command in the keyboard command system
- Use CommandModal component
- Scroll uses `smoothScrollToChapter` function (already exists, may need refinement)

**Acceptance criteria**:
- [x] `g` key opens modal
- [x] Typing updates the input display
- [x] Enter scrolls to valid chapter
- [x] Invalid chapter number handled gracefully
- [x] Escape cancels

---

## Task 7: Implement "Go to Book" Command (b) - ✅ DONE

**Goal**: Allow user to switch books using fuzzy search autocomplete.

**Details**:
- Pressing `b` opens a CommandModal with prompt "Go to book:"
- User starts typing book name
- Implement fuzzy search matching:
  - "gen" matches "Geneza"
  - "mat" matches "Matei"
  - "1 cor" matches "1 Corinteni"
  - Case insensitive
- Show the best match as autocomplete suggestion (grayed out text after cursor)
- Pressing Tab autocompletes to the best match
- Pressing Enter:
  - If input exactly matches a book, navigate to it
  - If input has a valid autocomplete suggestion, navigate to that book
  - Navigate means: load that book's content, scroll to top, reset line highlighter
- Use the book names from `src/data/books.json`

**Fuzzy search algorithm**:
- Simple approach: check if all characters of input appear in book name in order
- Example: "gn" matches "Geneza" (g...e...n...e...z...a)
- Prioritize matches that start with the input

**Acceptance criteria**:
- [x] `b` key opens modal
- [x] Fuzzy search finds matching books
- [x] Best match shown as autocomplete preview
- [x] Tab autocompletes
- [x] Enter navigates to book
- [x] Book content loads and displays correctly

---

## Task 8: Implement Line Highlighter (Visual Line Tracking) - ✅ DONE

**Goal**: Add a horizontal line that highlights the current reading line.

**Details**:
- When enabled (via visibility settings), show a semi-transparent light grey horizontal bar
- The bar spans the full width of the content area
- The bar height should match one line of text (based on line-height)
- Track which visual line is "current" (start at first line)
- The bar should be positioned over the current line
- Subtle styling: `background: rgba(0, 0, 0, 0.05)` or similar light grey

**Technical approach**:
- Calculate line height from CSS (currently `line-height: 2.2` on paragraphs with `font-size: 1.1rem`)
- Track current line as a Y-position offset
- Use a fixed/absolute positioned div for the highlight bar
- The bar moves based on the current line index

**State to track**:
- `highlighterY: number` - Y position of the highlighter
- `highlighterLineIndex: number` - which line (0-indexed) is highlighted

**Acceptance criteria**:
- [x] Highlighter bar appears when enabled
- [x] Bar is correctly sized to one line height
- [x] Bar is positioned correctly
- [x] Subtle, non-distracting visual style

---

## Task 9: Implement Line Highlighter Navigation (j/k keys) - ✅ DONE

**Goal**: Move the line highlighter up/down with keyboard.

**Details**:
- `j` moves highlighter down one line
- `k` moves highlighter up one line
- When highlighter moves off-screen, auto-scroll to keep it visible
- Scrolling should be smooth
- Highlighter should not move past the first or last line of content
- These keys only work when line highlighter is enabled

**Auto-scroll behavior**:
- If highlighter moves below viewport, scroll down so highlighter is near bottom
- If highlighter moves above viewport, scroll up so highlighter is near top
- Add small padding/margin so highlighter isn't at the very edge

**Acceptance criteria**:
- [x] `j` moves highlighter down
- [x] `k` moves highlighter up
- [x] Auto-scroll when highlighter leaves viewport
- [x] Smooth scrolling animation
- [x] Respects content boundaries

---

## Task 10: Implement Chapter Navigation (h/l keys) - ✅ DONE

**Goal**: Navigate between chapters using `h` (previous) and `l` (next).

**Details**:
- `l` goes to next chapter:
  - Scroll to the next chapter heading
  - Reset line highlighter to first line of that chapter
  - If at last chapter, do nothing
- `h` goes to previous chapter:
  - Scroll to the previous chapter heading
  - Reset line highlighter to first line of that chapter
  - If at first chapter, do nothing
- Smooth scrolling animation

**Acceptance criteria**:
- [x] `l` scrolls to next chapter
- [x] `h` scrolls to previous chapter
- [x] Line highlighter resets to chapter start
- [x] Boundary conditions handled (first/last chapter)
- [x] Smooth scroll animation

---

## Task 11: Implement Help Modal (? key) - Optional Enhancement

**Goal**: Show available keyboard shortcuts when user presses `?`.

**Details**:
- Pressing `?` opens a modal showing all available shortcuts
- List of shortcuts:
  - `g` - Go to chapter
  - `b` - Go to book
  - `v` - Visibility settings
  - `j` - Move highlighter down
  - `k` - Move highlighter up
  - `h` - Previous chapter
  - `l` - Next chapter
  - `Esc` - Cancel / Close modal
  - `?` - Show this help
- Simple, clean layout
- Press any key or Escape to close

**Acceptance criteria**:
- [ ] `?` opens help modal
- [ ] All shortcuts listed
- [ ] Any key closes the modal

---

## Task 12: Polish UI and Typography

**Goal**: Refine the overall visual design for a polished, minimalistic feel.

**Details**:
- Review and adjust:
  - Font sizes and line heights for optimal readability
  - Spacing and margins
  - Color palette (subtle greys, good contrast)
  - Chapter number watermark styling
  - Content max-width for comfortable reading
- Ensure consistent styling across all modals
- Add subtle transitions/animations where appropriate
- Test on different screen sizes
- Update page title and metadata in `layout.tsx`

**Acceptance criteria**:
- [ ] Typography is comfortable for extended reading
- [ ] Visual hierarchy is clear (book title, chapter numbers, verses)
- [ ] Modals are visually consistent
- [ ] App looks polished and intentional

---

## Task 13: Final Integration and Testing

**Goal**: Ensure all features work together correctly.

**Details**:
- Test all keyboard shortcuts in sequence
- Test visibility toggles with all combinations
- Test navigation across multiple books
- Test line highlighter with long chapters
- Test localStorage persistence (reload page, settings preserved)
- Test edge cases:
  - First/last chapter of a book
  - Very long chapters
  - Books with few chapters
  - Empty search input
  - Invalid chapter numbers
- Fix any integration issues

**Acceptance criteria**:
- [ ] All features work correctly in combination
- [ ] No console errors
- [ ] Smooth user experience
- [ ] Settings persist correctly

---

## Implementation Order Summary

1. **Task 1**: Keyboard Command System (foundation)
2. **Task 4**: Settings Context with localStorage (foundation)
3. **Task 2**: Command Modal Component (reusable UI)
4. **Task 3**: Visibility Modal (uses Task 2, Task 4)
5. **Task 5**: Verse Rendering with Numbers (uses Task 4)
6. **Task 6**: Go to Chapter Command (uses Task 1, Task 2)
7. **Task 7**: Go to Book Command (uses Task 1, Task 2)
8. **Task 8**: Line Highlighter Display (uses Task 4)
9. **Task 9**: Line Highlighter Navigation (uses Task 1, Task 8)
10. **Task 10**: Chapter Navigation (uses Task 1)
11. **Task 11**: Help Modal (optional, uses Task 2)
12. **Task 12**: UI Polish
13. **Task 13**: Final Testing

---

## Notes

- All keyboard commands should be disabled when a modal is open (except for modal-specific keys)
- Consider adding visual feedback when commands are activated (subtle flash or indication)
- The line highlighter visual line calculation may need adjustment based on actual rendered content
- Fuzzy search can be enhanced later with better algorithms if needed
