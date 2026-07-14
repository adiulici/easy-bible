# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server with Turbopack (http://localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
```

## Architecture

This is a Romanian Bible reader built with Next.js 15 (App Router) and React 19. It features vim-style keyboard navigation for reading scripture.

### Data Flow

- Bible content stored as JSON in `src/data/bible.json` (structured as `{book: {chapter: [{number, text}]}}`)
- Book names list in `src/data/books.json`
- API route `/api/bible?book=<name>` returns chapters for a book
- Settings persisted to localStorage via `SettingsContext`
- If any new setting is added, ask the user if he wants to persist it in the local storage (most likely yes)

### Keyboard Command System

The app uses a custom keyboard command system (`src/hooks/useKeyboardCommands.ts`) with two command types:

- **Single commands**: Execute immediately (j/k for verse navigation, u/d for page up/down, n/N for previous/next chapter, gg/G for first/last chapter — gg is a two-key chord, m to toggle a bookmark on the highlighted verse)
- **Modal commands**: Open input modals (c for go-to-chapter, b for go-to-book, v for visibility settings, M for the bookmarks list)

Commands are registered in `page.tsx` using `registerCommand()`. The hook manages mode state and input buffering.

### Component Structure

- `page.tsx` - Main page, orchestrates book/chapter/verse rendering and all keyboard navigation
- `CommandModal` - Generic modal for text input commands with autocomplete support
- `VisibilityModal` - Toggle display options (chapter numbers, verse numbers, verse highlighter)
- `BookmarksModal` - List/jump/delete verse bookmarks (opened with `M`)
- `Toast` - Transient, presentational hint message (e.g. bookmark-requires-highlighter)
- `SettingsContext` - Global settings state with localStorage persistence (includes `bookmarks`)

### Path Alias

`@/*` maps to `./src/*` (configured in tsconfig.json)
