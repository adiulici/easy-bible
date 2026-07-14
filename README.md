# Biblia

A Romanian Bible reader built with Next.js 15 (App Router) and React 19, with vim-style keyboard navigation for reading scripture.

## Getting Started

```bash
npm run dev      # Start dev server with Turbopack (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Keyboard Commands

- `j` / `k` — move the verse highlighter down / up (or nudge-scroll the page when the highlighter is off)
- `u` / `d` — page up / down
- `gg` / `G` — go to the first / last chapter
- `N` / `n` — go to previous / next chapter
- `c` — go to chapter (type a chapter number, Enter to jump)
- `b` — go to book (type a name, Tab to autocomplete, Enter to jump)
- `v` — toggle visibility settings (chapter numbers, verse numbers, verse highlighter)
- `m` — bookmark/unbookmark the highlighted verse (requires the verse highlighter on)
- `M` — open the bookmarks list (`j`/`k` move, `Enter` jumps + closes, `x` deletes, `Esc` closes)
- `Escape` — cancel the current modal

## Architecture

- Bible content is stored as JSON in `src/data/bible.json` (structured as `{book: {chapter: [{number, text}]}}`), with the list of book names in `src/data/books.json`.
- The API route `/api/bible?book=<name>` returns a book's chapters.
- Settings (visibility toggles, current book/chapter) persist to `localStorage` via `SettingsContext`.
- Keyboard input is handled by a custom command system in `src/hooks/useKeyboardCommands.ts`, supporting single-key commands (executed immediately) and modal commands (which open an input modal). Commands are registered in `page.tsx` via `registerCommand()`.

See `CLAUDE.md` for more implementation detail.
