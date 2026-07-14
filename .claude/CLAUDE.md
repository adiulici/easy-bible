# Claude Code Instructions

Biblia — a Romanian Bible reader (Next.js 15 App Router + React 19) with vim-style keyboard navigation for reading scripture.

## Inviolable principles

**STOP. THINK. THEN ACT.** No fast fingers. Before any major direction change, commit, destructive op, or multi-step work — confirm with the user. Every time.

- **NEVER make architectural decisions on the fly.** Routing, infrastructure, service boundaries, schema shape — stop and discuss.
- **NEVER pick the quick fix over the right fix.** When the right approach takes more work, that's the approach.
- **NEVER assume you know better than the user.** When in doubt, ask.
- **ALWAYS verify your own output.** Read the actual file, run the actual command, check the actual result. Don't assume.
- **NEVER commit, push, or run destructive ops without explicit user approval** (`drop`, `rm -rf`, `git reset --hard`, force-push, truncate, etc.). The user decides what's disposable.
- **Centralize configuration.** No hardcoded values. Ports, URLs, secrets — one source of truth.
- **SOLID + small functions + minimal nesting.** Composition over inheritance. Explicit naming. Guard clauses.
- **Use design tokens (CSS custom properties / theme values) for color, spacing, and typography — never hardcode hex colors, pixel spacing, or font sizes in components.**
- **Meet a baseline of accessibility on every interactive element:** semantic elements over `div` soup, a labeled name for every control, visible keyboard focus, and color contrast that passes WCAG AA.

## Convention summary

Workflow rules for anyone working in this codebase:

- **Plan-first for non-trivial work.** Plans live in `docs/plans/` (gitignored). After implementation, structural decisions are absorbed into `docs/ARCHITECTURE.md` and the plan file is deleted.
- **Worktree-first.** Branch work runs in `.worktrees/<branch>` — never directly in the main checkout.
- **Agent-dispatch for non-trivial implementation.** Dispatched agents work inside the worktree, leave changes unstaged, never commit. The orchestrator runs review, fixes Critical/Important findings, then surfaces to the user.
- **Pre-commit gates (in order):** `npm run lint` → `npm run build`. Never `--no-verify`. Never `it.skip` as a "fix".
- **Devil's advocate after each chunk.** What breaks under unexpected input? Simplest production failure?
- **Commit messages:** single-line, imperative, no period. No ticket prefix (free-form). Rationale belongs in the PR description, never `git log`.
- **Branch naming:** `<short-description>`.
- **PRs merge with a regular merge commit by default — not squash (preserve history).**
- **Canonical scripts** (use these, never start things manually): `npm run dev` (port 5501), `npm run build`, `npm run lint`.
- **Tech stack:** Next.js 15 (App Router), React 19, TypeScript, plain CSS.
- **Keep components small and single-purpose:** presentational components stay free of data-fetching and business logic; lift shared state rather than prop-drilling deeply.
- **Co-locate component, its styles, and its tests; name the folder for the component it serves.**
- **Product-side specs:** none — self-driven (features scoped from conversation).
- `qa-mode: in-flow`

## Index — where to go next

| Looking for... | Read... |
|---|---|
| Architecture truth (current state, Decision Changelog) | `docs/ARCHITECTURE.md` |
