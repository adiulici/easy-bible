# Architecture

Romanian Bible reader built with Next.js 15 (App Router) and React 19, featuring
vim-style keyboard navigation. This document is the architecture-truth reference;
`CLAUDE.md` carries the working-instruction summary.

## Data flow

- Bible content is JSON in `src/data/bible.json`, shaped `{book: {chapter: [{number, text}]}}`.
- Book names list in `src/data/books.json`.
- API route `/api/bible?book=<name>` returns the chapters for a book.
- User settings persist to `localStorage` under the `biblia-settings` key via
  `SettingsContext`, which defaults-merges the stored blob against
  `defaultSettings` so older blobs missing newer keys stay valid.

## Keyboard command system

`src/hooks/useKeyboardCommands.ts` drives navigation with two command kinds:

- **Single commands** execute immediately: `j`/`k` (verse), `u`/`d` (page),
  `n`/`N` (prev/next chapter), `gg`/`G` (first/last chapter; `gg` is a two-key
  chord), `m` (toggle a bookmark on the highlighted verse).
- **Modal commands** open input modals: `c` (go-to-chapter), `b` (go-to-book),
  `v` (visibility settings), `M` (bookmarks list).

Commands are registered in `page.tsx` via `registerCommand()`.

## Component structure

- `page.tsx` — main page; orchestrates book/chapter/verse rendering and all
  keyboard navigation.
- `CommandModal` — generic text-input modal with autocomplete.
- `VisibilityModal` — toggles display options (chapter numbers, verse numbers,
  verse highlighter).
- `BookmarksModal` — lists, jumps to, and deletes verse bookmarks (opened with `M`).
- `Toast` — transient, presentational hint message (e.g. the
  bookmark-requires-highlighter hint).
- `SettingsContext` — global settings state with `localStorage` persistence,
  including the `bookmarks` list.

## Verse bookmarks

- A verse is bookmarked with `m`, which **requires the verse highlighter to be
  on** and toggles the bookmark on the currently highlighted verse. The `M`
  modal reviews the list and jumps to or deletes entries.
- **Identity** is the `(book, chapter, verse)` tuple. Pure, framework-free list
  logic (toggle, remove, dedupe, snippet building) lives in
  `src/utils/bookmarks.ts` and returns new arrays (immutable). `SettingsContext`
  wraps these helpers and exposes `toggleBookmark` / `removeBookmark`,
  persisting `bookmarks: Bookmark[]` inside the existing `biblia-settings` blob.
- **Cross-book jump.** The reading `content` state carries no book identity, so a
  `contentBookRef` tracks the book that `content` actually holds. Jumping to a
  bookmark in another book stashes a `pendingJumpRef` and, once the target book's
  content loads, a `content`-keyed effect completes the jump through the pure
  `decidePendingJump` helper (which gates on the book content actually holds, not
  the synchronously-flipped current-book setting, so a jump never completes
  against stale content and a superseded jump is abandoned rather than left to
  suppress later resets).

## Conventions

- **New styles** use module-scoped CSS custom properties (e.g.
  `--bookmark-accent`, `--toast-bg`) for markers and toasts. Pre-existing
  hardcoded style modules are left untouched.
- **Testing.** Vitest + React Testing Library. `npm test` runs `vitest run`,
  `npm run test:watch` runs `vitest`, and `npm run typecheck:test` runs
  `tsc -p tsconfig.test.json --noEmit`. `vitest.config.ts` sets `jsdom`,
  `globals`, the `@` → `./src` alias, and `esbuild.jsx: "automatic"` (React 19).
  The base `tsconfig.json` excludes only the vitest config files;
  `tsconfig.test.json` typechecks tests with jest-dom + `vitest/globals` types; a
  root `jest-dom.d.ts` loads the matcher augmentation so `next build` also
  typechecks tests. Tests co-locate as `*.test.ts(x)` beside their source.

## Path alias

`@/*` maps to `./src/*` (configured in `tsconfig.json`).

## Known limitations / follow-ons

- The reading `content` state does not carry its own book identity; a
  `contentBookRef` compensates and three effects must be aware of
  `pendingJumpRef`. A deeper refactor — self-describing
  `content = { book, chapters }` plus a single pending-scroll intent — would
  remove the ref and collapse the special-cases. Deferred as out-of-scope.
