# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## General rules

- Work always on main, unless the user explicitly asks otherwise
- No commits: only the user makes commits

## Commands

```bash
npm run dev      # Start dev server with Turbopack (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

This is a Romanian Bible reader built with Next.js 15 (App Router) and React 19. It features vim-style keyboard navigation for reading scripture.

### Data Flow

- Bible content is bundled per translation in `src/data/bible.<VERSION>.json` (`VDC`, `NTR`),
  structured as `{bookName: {chapter: Block[]}}`. A `Block` is one of `heading`
  (`{type, level, text}`), `poetry` (`{type, lines: [{verse, indent, text}]}`), or
  `paragraph` (`{type, verses: [{verse, text}]}`) — see `src/types/bible.ts`.
- The bundles are generated from the `bible-fetcher` output tree by the re-runnable
  transform `scripts/build-bible.mjs` (`node scripts/build-bible.mjs [pathToFetcherOut]`).
  It maps the fetcher's USFM book codes to Romanian names purely by canonical ordinal
  position (both lists are the same 66 books in canonical order).
- Book names list in `src/data/books.json` (the sole book id: API param, fuzzy-match target,
  bookmark key). Bookmarks are translation-agnostic (book/chapter/verse only).
- API route `/api/bible?book=<name>&version=<VDC|NTR>` returns a book's chapters (blocks)
  for a translation; `version` defaults to `VDC`.
- Pure helpers in `src/utils/blocks.ts` read verse identity out of the block shapes
  (`chapterVerseNumbers`, `firstVerseNumber`, `lastVerseNumber`, `findVerseText`,
  `flattenVerses`) so the highlighter/bookmark hooks work against blocks.
- Verse text is plain (no inline markup); the old dataset's red-letter words-of-Jesus
  spans are intentionally not carried over.
- Settings persisted to localStorage via `SettingsContext` (includes `currentTranslation`).
- If any new setting is added, ask the user if he wants to persist it in the local storage (most likely yes)

### Keyboard Command System

The app uses a custom keyboard command system (`src/hooks/useKeyboardCommands.ts`) with two command types:

- **Single commands**: Execute immediately (j/k for verse navigation, u/d for page up/down, n/N for previous/next chapter, gg/G for first/last chapter — gg is a two-key chord, m to toggle a bookmark on the highlighted verse)
- **Modal commands**: Open input modals (c for go-to-chapter, b for go-to-book, v for visibility settings, M for the bookmarks list, t for the translation switcher)

Commands are registered in `page.tsx` using `registerCommand()`. The hook manages mode state and input buffering.

### Component Structure

- `page.tsx` - Main page, orchestrates book/chapter/verse rendering and all keyboard navigation
- `CommandModal` - Generic modal for text input commands with autocomplete support
- `VisibilityModal` - Toggle display options (chapter numbers, verse numbers, verse highlighter)
- `BookmarksModal` - List/jump/delete verse bookmarks (opened with `M`)
- `TranslationModal` - Switch active translation VDC/NTR (opened with `t`)
- `Toast` - Transient, presentational hint message (e.g. bookmark-requires-highlighter)
- `SettingsContext` - Global settings state with localStorage persistence (includes `bookmarks`)

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json)
