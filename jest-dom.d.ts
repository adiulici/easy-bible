// Makes the @testing-library/jest-dom matchers (e.g. toBeInTheDocument,
// toHaveTextContent) resolve on vitest's `expect` for ANY typecheck that uses
// the base tsconfig - including `next build`, which now type-checks the
// (no-longer-excluded) *.test.tsx files. Test-only concern, types only, no
// runtime cost. The dedicated tsconfig.test.json declares these via its `types`
// field instead; this file covers the base project pass.
import "@testing-library/jest-dom/vitest";
